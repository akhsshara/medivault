import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { config } from '../config.js'
import { User } from '../models.js'

const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env
if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 16) {
  console.error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD (at least 16 characters) in the environment before running seed:admin.')
  process.exit(1)
}

try {
  await mongoose.connect(config.MONGO_URI)
  const email = ADMIN_EMAIL.toLowerCase()
  const existing = await User.findOne({ email })
  if (existing) {
    console.error('That email already belongs to an account. No changes were made.')
    process.exitCode = 1
  } else {
    await User.create({ name: ADMIN_NAME, email, role: 'admin', passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) })
    console.info('Admin account created.')
  }
} catch (error) {
  console.error('Admin account was not created:', error.message)
  process.exitCode = 1
} finally {
  await mongoose.disconnect()
}
