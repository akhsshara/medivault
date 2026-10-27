import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { User } from './models.js'
import { asyncRoute, populateMembership } from './lib.js'

export const authenticate = asyncRoute(async (req, res, next) => {
  const token = req.cookies?.[config.cookieName]
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  let payload
  try {
    payload = jwt.verify(token, config.JWT_SECRET, { issuer: 'medivault-api', audience: 'medivault-client' })
  } catch {
    return res.status(401).json({ error: 'Session expired or invalid' })
  }
  const user = await User.findById(payload.sub)
  if (!user || !user.active || payload.ver !== user.sessionVersion) return res.status(401).json({ error: 'Account unavailable' })
  req.user = user
  await populateMembership(req)
  next()
})

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'You are not authorized to perform this action' })
    next()
  }
}

export function requireVerifiedHospital(req, res, next) {
  if (req.user?.role !== 'hospital_staff' || !req.membership) return res.status(403).json({ error: 'A verified hospital membership is required' })
  next()
}

export function requireRequestOrigin(req, res, next) {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !config.allowedOrigins.includes(req.get('origin'))) {
    return res.status(403).json({ error: 'Request origin is not allowed' })
  }
  next()
}
