import bcrypt from 'bcryptjs'
import express from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { AuditEvent, ConsentGrant, CorrectionRequest, MedicalRecord, Organization, OrganizationMembership, User } from '../models.js'
import { asyncRoute, audit } from '../lib.js'
import { requireRole } from '../middleware.js'

const router = express.Router()
router.use(requireRole('admin'))

router.get('/organizations', asyncRoute(async (req, res) => {
  const filter = { isDemo: { $ne: true } }
  if (['pending', 'verified', 'rejected', 'suspended'].includes(req.query.status)) filter.status = req.query.status
  const organizations = await Organization.find(filter).sort({ createdAt: -1 }).limit(300)
  res.json({ organizations: organizations.map((org) => ({ id: org._id, name: org.name, type: org.type, registrationId: org.registrationId, status: org.status, createdAt: org.createdAt, reviewedAt: org.reviewedAt })) })
}))

router.get('/staff', asyncRoute(async (_req, res) => {
  const staff = await User.find({ role: { $in: ['hospital_staff', 'admin'] } }).select('name email role active').sort({ name: 1 }).limit(1000)
  const memberships = await OrganizationMembership.find({ userId: { $in: staff.map((user) => user._id) }, active: true }).populate('organizationId', 'name status')
  const byUser = new Map(memberships.map((membership) => [String(membership.userId), membership]))
  res.json({ staff: staff.map((user) => {
    const membership = byUser.get(String(user._id))
    return { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active, organization: membership?.organizationId?.name || 'MediVault', membershipRole: membership?.role || 'Platform admin' }
  }) })
}))

router.patch('/staff/:userId/status', asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.userId)) return res.status(404).json({ error: 'Staff account not found' })
  if (String(req.user._id) === req.params.userId) return res.status(400).json({ error: 'You cannot suspend your own admin account' })
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose an account status' })
  const previous = await User.findOne({ _id: req.params.userId, role: { $in: ['hospital_staff', 'admin'] } }).select('active sessionVersion')
  if (!previous) return res.status(404).json({ error: 'Staff account not found' })
  const user = await User.findOneAndUpdate({ _id: req.params.userId }, { $set: { active: parsed.data.active }, $inc: { sessionVersion: 1 } }, { new: true }).select('name email role active')
  try { await audit(req, { action: parsed.data.active ? 'account.reactivated' : 'account.suspended', resourceType: 'User', resourceId: user._id }) }
  catch (error) { await User.updateOne({ _id: previous._id }, { active: previous.active, sessionVersion: previous.sessionVersion }); throw error }
  res.json({ user: { id: user._id, name: user.name, email: user.email, role: user.role, active: user.active } })
}))

router.post('/organizations', asyncRoute(async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(180), type: z.enum(['hospital', 'clinic', 'laboratory', 'diagnostic_centre']), registrationId: z.string().trim().max(100).optional() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Provide an organization name and type' })
  const org = await Organization.create({ ...parsed.data, status: 'pending' })
  try { await audit(req, { action: 'organization.created', resourceType: 'Organization', resourceId: org._id }) }
  catch (error) { await Organization.deleteOne({ _id: org._id }); throw error }
  res.status(201).json({ organization: { id: org._id, name: org.name, type: org.type, status: org.status } })
}))

router.patch('/organizations/:organizationId/status', asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.organizationId)) return res.status(404).json({ error: 'Organization not found' })
  const parsed = z.object({ status: z.enum(['verified', 'rejected', 'suspended']) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose verified, rejected or suspended' })
  const previous = await Organization.findById(req.params.organizationId)
  if (!previous || previous.isDemo) return res.status(404).json({ error: 'Organization not found' })
  const organization = await Organization.findByIdAndUpdate(req.params.organizationId, { status: parsed.data.status, reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true })
  try { await audit(req, { action: 'organization.status_changed', resourceType: 'Organization', resourceId: organization._id, organizationId: organization._id, metadata: { status: organization.status } }) }
  catch (error) { await Organization.updateOne({ _id: previous._id }, { status: previous.status, reviewedBy: previous.reviewedBy, reviewedAt: previous.reviewedAt }); throw error }
  res.json({ organization: { id: organization._id, name: organization.name, status: organization.status, reviewedAt: organization.reviewedAt } })
}))

router.post('/organizations/:organizationId/staff', asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.organizationId)) return res.status(404).json({ error: 'Organization not found' })
  const parsed = z.object({ name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(128), role: z.enum(['clinician', 'records_staff', 'organization_admin']) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Provide name, email, temporary password (12+ characters) and a staff role' })
  const organization = await Organization.findOne({ _id: req.params.organizationId, status: 'verified', isDemo: { $ne: true } })
  if (!organization) return res.status(404).json({ error: 'Verified organization not found' })
  const email = parsed.data.email.toLowerCase()
  if (await User.exists({ email })) return res.status(409).json({ error: 'An account already exists for that email' })
  const user = await User.create({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12), role: 'hospital_staff' })
  try {
    await OrganizationMembership.create({ userId: user._id, organizationId: organization._id, role: parsed.data.role })
  } catch (error) {
    await User.deleteOne({ _id: user._id })
    throw error
  }
  try { await audit(req, { action: 'organization.staff_added', resourceType: 'User', resourceId: user._id, organizationId: organization._id }) }
  catch (error) {
    await OrganizationMembership.deleteOne({ userId: user._id, organizationId: organization._id })
    await User.deleteOne({ _id: user._id })
    throw error
  }
  res.status(201).json({ user: { id: user._id, name: user.name, email: user.email, role: user.role }, organization: { id: organization._id, name: organization.name }, membershipRole: parsed.data.role })
}))

router.get('/corrections', asyncRoute(async (_req, res) => {
  const requests = await CorrectionRequest.find({ status: { $in: ['open', 'reviewing'] } }).populate('patientId', 'name email').populate('recordId', 'title category').sort({ createdAt: 1 }).limit(500)
  res.json({ requests: requests.map((request) => ({ id: request._id, patient: { id: request.patientId._id, name: request.patientId.name, email: request.patientId.email }, record: request.recordId ? { id: request.recordId._id, title: request.recordId.title, category: request.recordId.category } : null, reason: request.reason, status: request.status, createdAt: request.createdAt })) })
}))

router.patch('/corrections/:requestId', asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId)) return res.status(404).json({ error: 'Correction request not found' })
  const parsed = z.object({ status: z.enum(['reviewing', 'resolved', 'dismissed']), resolutionNote: z.string().trim().max(1000).optional() }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose reviewing, resolved or dismissed' })
  const previous = await CorrectionRequest.findById(req.params.requestId)
  if (!previous) return res.status(404).json({ error: 'Correction request not found' })
  const correction = await CorrectionRequest.findByIdAndUpdate(req.params.requestId, { ...parsed.data, resolvedBy: req.user._id }, { new: true })
  try { await audit(req, { action: 'record.correction_reviewed', resourceType: 'CorrectionRequest', resourceId: correction._id, patientId: correction.patientId, metadata: { status: correction.status } }) }
  catch (error) {
    await CorrectionRequest.updateOne({ _id: previous._id }, { status: previous.status, resolvedBy: previous.resolvedBy, resolutionNote: previous.resolutionNote })
    throw error
  }
  res.json({ request: { id: correction._id, status: correction.status } })
}))

router.get('/audit', asyncRoute(async (req, res) => {
  const limit = Math.max(1, Math.min(200, Number.parseInt(req.query.limit, 10) || 100))
  const events = await AuditEvent.find().sort({ createdAt: -1 }).limit(limit).populate('organizationId', 'name')
  res.json({ events: events.map((event) => ({ id: event._id, action: event.action, resourceType: event.resourceType, occurredAt: event.createdAt, actorRole: event.actorRole, organization: event.organizationId?.name || null, patientId: event.patientId || null, outcome: event.outcome })) })
}))

router.get('/summary', asyncRoute(async (_req, res) => {
  const [organizations, users, records, activeGrants] = await Promise.all([
    Organization.aggregate([{ $match: { isDemo: { $ne: true } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.countDocuments(),
    MedicalRecord.countDocuments(),
    ConsentGrant.countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
  ])
  res.json({ users, records, activeGrants, organizations: Object.fromEntries(organizations.map((item) => [item._id, item.count])) })
}))

export default router
