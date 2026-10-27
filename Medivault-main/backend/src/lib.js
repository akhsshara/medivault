import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from './config.js'
import { AuditEvent, ConsentGrant, OrganizationMembership } from './models.js'

export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}

export function signSession(userId, sessionVersion = 0) {
  return jwt.sign({ sub: String(userId), ver: sessionVersion }, config.JWT_SECRET, { expiresIn: '12h', issuer: 'medivault-api', audience: 'medivault-client' })
}

export function sessionCookieOptions() {
  return { httpOnly: true, secure: config.production, sameSite: 'strict', path: '/api', maxAge: 12 * 60 * 60 * 1000 }
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function audit(req, event) {
  try {
    await AuditEvent.create({ actorId: req.user?._id, actorRole: req.user?.role || 'system', ipAddress: req.ip, ...event })
  } catch (error) {
    console.error('Audit event write failed:', error.message)
    throw new Error('Sensitive action could not be recorded')
  }
}

export async function getVerifiedMembership(userId) {
  const membership = await OrganizationMembership.findOne({ userId, active: true }).populate('organizationId')
  if (!membership || membership.organizationId.status !== 'verified' || membership.organizationId.isDemo) return null
  return membership
}

export async function activeGrantFor(patientId, organizationId, category) {
  const grants = await ConsentGrant.find({ patientId, organizationId, revokedAt: null, expiresAt: { $gt: new Date() } })
  return grants.find((grant) => grant.scope === 'all' || !category || grant.scope === category) || null
}

export async function canAccessPatientRecord(req, record) {
  if (req.user.role === 'patient') return String(record.patientId) === String(req.user._id)
  if (req.user.role !== 'hospital_staff') return false
  const membership = req.membership || await getVerifiedMembership(req.user._id)
  if (!membership || membership.role === 'records_staff') return false
  return membership ? Boolean(await activeGrantFor(record.patientId, membership.organizationId._id, record.category)) : false
}

export function recordScope(req, activeGrants) {
  if (req.user.role === 'patient') return { patientId: req.user._id }
  if (req.membership?.role === 'records_staff') return { _id: null }
  const permitted = []
  const allPatients = activeGrants.filter((grant) => grant.scope === 'all').map((grant) => grant.patientId)
  if (allPatients.length) permitted.push({ patientId: { $in: allPatients } })
  const byPatient = new Map()
  for (const grant of activeGrants) {
    if (grant.scope === 'all') continue
    const key = String(grant.patientId)
    if (!byPatient.has(key)) byPatient.set(key, [])
    byPatient.get(key).push(grant.scope)
  }
  for (const [patientId, categories] of byPatient) permitted.push({ patientId, category: { $in: [...new Set(categories)] } })
  return permitted.length ? { $or: permitted } : { _id: null }
}

export function safeUser(user) {
  return { id: String(user._id), name: user.name, email: user.email, role: user.role }
}

export async function populateMembership(req) {
  if (req.user.role !== 'hospital_staff') return null
  const membership = await getVerifiedMembership(req.user._id)
  if (membership) req.membership = membership
  return membership
}
