import { createServer } from 'node:http'
import app from './app.js'
import { config } from './config.js'
import { connectDatabase } from './db.js'

try {
  await connectDatabase()
  const server = createServer(app)
  server.listen(config.PORT, () => console.info(`MediVault API listening on port ${config.PORT}`))
  const shutdown = async () => {
    server.close(() => process.exit(0))
  }
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
} catch (error) {
  console.error('MediVault could not start:', error.message)
  process.exit(1)
}
