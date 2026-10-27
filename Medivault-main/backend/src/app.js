import path from 'node:path'
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { fileURLToPath } from 'node:url'
import { config } from './config.js'
import { authenticate, requireRequestOrigin } from './middleware.js'
import authRouter from './routes/auth.js'
import recordsRouter, { hospitalRecordsRouter } from './routes/records.js'
import consentsRouter from './routes/consents.js'
import auditRouter from './routes/audit.js'
import adminRouter from './routes/admin.js'
import profileRouter from './routes/profile.js'

const app = express()
const dirname = path.dirname(fileURLToPath(import.meta.url))
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many account requests. Please try again later.' } })
const uploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Upload limit reached. Please try again later.' } })

app.disable('x-powered-by')
app.set('trust proxy', config.production ? 1 : false)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-origin' },
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
      'img-src': ["'self'", 'data:', 'blob:'],
      'frame-src': ["'self'"],
    },
  },
}))
app.use(cors({ origin: config.allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type'] }))
app.use(express.json({ limit: '32kb' }))
app.use(cookieParser())
app.use(requireRequestOrigin)

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }))
app.use('/api/auth', authLimiter, authRouter)
app.use('/api/profile', authenticate, profileRouter)
app.use('/api/records', uploadLimiter, authenticate, recordsRouter)
app.use('/api/hospital', uploadLimiter, authenticate, hospitalRecordsRouter)
app.use('/api', authenticate, consentsRouter)
app.use('/api', authenticate, auditRouter)
app.use('/api/admin', authenticate, adminRouter)

const clientDist = path.resolve(dirname, '../../frontend/dist')
app.use(express.static(clientDist, { index: false, maxAge: config.production ? '1h' : 0, dotfiles: 'deny', setHeaders: (res, filePath) => {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-store')
} }))
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next()
  res.sendFile(path.join(clientDist, 'index.html'), (error) => { if (error) next() })
})

app.use((err, _req, res, _next) => {
  if (err?.name === 'MulterError') {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
    return res.status(status).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 20 MB limit' : 'Upload could not be processed' })
  }
  if (err?.message?.startsWith('Only PDF') || err?.message?.startsWith('File content')) return res.status(400).json({ error: err.message })
  if (err?.name === 'ValidationError' || err?.name === 'ZodError') return res.status(400).json({ error: 'Request data is invalid' })
  if (err?.code === 11000) return res.status(409).json({ error: 'An account or record with that value already exists' })
  if (err?.message === 'Sensitive action could not be recorded') return res.status(503).json({ error: 'The action could not be securely recorded. Please retry.' })
  console.error('Unhandled API error:', config.production ? err?.name || 'Error' : err)
  res.status(500).json({ error: 'Unexpected server error' })
})

export default app
