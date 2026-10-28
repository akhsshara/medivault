import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import express from 'express'
import { rateLimit } from 'express-rate-limit'
import nodemailer from 'nodemailer'
import { z } from 'zod'
import { config } from '../config.js'
import { User } from '../models.js'
import { asyncRoute, audit, hashToken, safeUser, sessionCookieOptions, signSession } from '../lib.js'
import { authenticate } from '../middleware.js'

const router = express.Router()
// Apply the brute-force limiter only to credential/reset operations. Session
// checks and logout are routine requests and should not consume login attempts.
const authAttemptLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Too many account requests. Please try again later.' } })
const registerSchema = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(128) })
const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(1).max(128) })
const resetSchema = z.object({ token: z.string().min(40).max(200), password: z.string().min(12).max(128) })
const resetTransport = config.mailConfigured ? nodemailer.createTransport({ host: config.SMTP_HOST, port: config.SMTP_PORT, secure: config.SMTP_SECURE === 'true', auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }) : null

router.post('/register', authAttemptLimiter, asyncRoute(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a name, valid email and password of at least 12 characters' })
  const email = parsed.data.email.toLowerCase()
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account already exists for that email' })
  const user = await User.create({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'patient' })
  try { await audit(req, { action: 'account.registered', resourceType: 'User', resourceId: user._id, patientId: user._id }) }
  catch (error) { await User.deleteOne({ _id: user._id }); throw error }
  res.cookie(config.cookieName, signSession(user._id, user.sessionVersion), sessionCookieOptions())
  res.status(201).json({ user: safeUser(user) })
}))

router.post('/login', authAttemptLimiter, asyncRoute(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email and password' })
  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select('+passwordHash')
  if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
    await audit(req, { action: 'auth.login', resourceType: 'Session', outcome: 'denied', metadata: { emailProvided: true } })
    return res.status(401).json({ error: 'Email or password is incorrect' })
  }
  await audit(req, { action: 'auth.login', resourceType: 'Session', resourceId: user._id, patientId: user.role === 'patient' ? user._id : undefined })
  res.cookie(config.cookieName, signSession(user._id, user.sessionVersion), sessionCookieOptions())
  res.json({ user: safeUser(user) })
}))

router.post('/logout', authenticate, asyncRoute(async (req, res) => {
  await audit(req, { action: 'auth.logout', resourceType: 'Session', resourceId: req.user._id, patientId: req.user.role === 'patient' ? req.user._id : undefined })
  req.user.sessionVersion += 1
  await req.user.save()
  res.clearCookie(config.cookieName, { ...sessionCookieOptions(), maxAge: undefined })
  res.json({ ok: true })
}))

router.get('/me', authenticate, (req, res) => res.json({ user: safeUser(req.user), organization: req.membership ? { id: req.membership.organizationId._id, name: req.membership.organizationId.name, status: req.membership.organizationId.status, role: req.membership.role } : null }))

router.post('/forgot-password', authAttemptLimiter, asyncRoute(async (req, res) => {
  const email = z.string().email().safeParse(req.body?.email)
  if (!email.success) return res.status(400).json({ error: 'Enter a valid email address' })
  const user = await User.findOne({ email: email.data.toLowerCase(), active: true })
  if (user && resetTransport) {
    const token = crypto.randomBytes(32).toString('hex')
    user.resetTokenHash = hashToken(token)
    user.resetExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()
    const resetUrl = new URL('/reset-password', config.APP_ORIGIN)
    resetUrl.searchParams.set('token', token)
    await resetTransport.sendMail({
      from: config.SMTP_FROM,
      to: user.email,
      subject: 'Reset your MediVault password',
      text: `Use this link within one hour to reset your MediVault password: ${resetUrl.toString()}\n\nIf you did not request a reset, you can ignore this email.`,
    })
  }
  res.status(202).json({ message: 'If an active account matches that address, password reset instructions will be sent.' })
}))

router.post('/reset-password', authAttemptLimiter, asyncRoute(async (req, res) => {
  const parsed = resetSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Provide a valid reset token and a password of at least 12 characters' })
  const user = await User.findOne({ resetTokenHash: hashToken(parsed.data.token), resetExpiresAt: { $gt: new Date() }, active: true }).select('+resetTokenHash +resetExpiresAt +passwordHash')
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or expired' })
  const oldPasswordHash = user.passwordHash
  const oldResetTokenHash = user.resetTokenHash
  const oldResetExpiresAt = user.resetExpiresAt
  const oldSessionVersion = user.sessionVersion
  user.passwordHash = await bcrypt.hash(parsed.data.password, 12)
  user.sessionVersion += 1
  user.resetTokenHash = undefined
  user.resetExpiresAt = undefined
  await user.save()
  try { await audit(req, { action: 'auth.password_reset', resourceType: 'User', resourceId: user._id, patientId: user.role === 'patient' ? user._id : undefined }) }
  catch (error) {
    user.passwordHash = oldPasswordHash
    user.resetTokenHash = oldResetTokenHash
    user.resetExpiresAt = oldResetExpiresAt
    user.sessionVersion = oldSessionVersion
    await user.save()
    throw error
  }
  res.json({ message: 'Password updated. Sign in with your new password.' })
}))

export default router
