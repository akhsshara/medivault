import express from 'express'
import { AuditEvent } from '../models.js'
import { asyncRoute } from '../lib.js'
import { requireRole, requireVerifiedHospital } from '../middleware.js'

const router = express.Router()

router.get('/audit', requireRole('patient', 'hospital_staff', 'admin'), asyncRoute(async (req, res) => {
  const filter = {}
  if (req.user.role === 'patient') filter.patientId = req.user._id
  else if (req.user.role === 'hospital_staff') {
    if (!req.membership) return res.status(403).json({ error: 'A verified hospital membership is required' })
    filter.organizationId = req.membership.organizationId._id
  }
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 50))
  const events = await AuditEvent.find(filter).sort({ createdAt: -1 }).limit(limit).populate('organizationId', 'name')
  res.json({ events: events.map((event) => ({
    id: event._id,
    action: event.action,
    resourceType: event.resourceType,
    occurredAt: event.createdAt,
    outcome: event.outcome,
    ...(req.user.role === 'admin' ? { actorRole: event.actorRole, organization: event.organizationId?.name || null, patientId: event.patientId || null } : {}),
    ...(req.user.role === 'hospital_staff' ? { actorRole: event.actorRole } : {}),
  })) })
}))

export default router
