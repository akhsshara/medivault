import express from 'express'
import mongoose from 'mongoose'
import { z } from 'zod'
import { ConsentGrant, Organization } from '../models.js'
import { asyncRoute, audit } from '../lib.js'
import { requireRole } from '../middleware.js'
import { config } from '../config.js'

const router = express.Router()
const scopeMap = { all: 'all', prescriptions: 'prescription', lab_reports: 'lab_report', scans: 'scan', diagnoses: 'diagnosis', discharge_summaries: 'discharge_summary' }

router.get('/organizations', requireRole('patient'), asyncRoute(async (_req, res) => {
  const filter = config.production ? { status: 'verified', isDemo: { $ne: true } } : { status: 'verified' }
  const organizations = await Organization.find(filter).select('name type isDemo').sort({ name: 1 }).limit(100)
  res.json({ organizations: organizations.map((org) => ({ id: org._id, name: org.name, type: org.type, isDemo: Boolean(org.isDemo) })) })
}))

router.get('/consents', requireRole('patient'), asyncRoute(async (req, res) => {
  const grants = await ConsentGrant.find({ patientId: req.user._id }).populate('organizationId', 'name type status isDemo').sort({ createdAt: -1 }).limit(200)
  await audit(req, { action: 'consent.listed', resourceType: 'ConsentGrant', patientId: req.user._id, metadata: { resultCount: grants.length } })
  res.json({ grants: grants.map((grant) => ({
    id: grant._id,
    organization: { id: grant.organizationId._id, name: grant.organizationId.name, type: grant.organizationId.type, isDemo: Boolean(grant.organizationId.isDemo) },
    scope: grant.scope,
    createdAt: grant.createdAt,
    expiresAt: grant.expiresAt,
    revokedAt: grant.revokedAt || null,
    active: !grant.revokedAt && grant.expiresAt > new Date() && grant.organizationId.status === 'verified',
  })) })
}))

router.post('/consents', requireRole('patient'), asyncRoute(async (req, res) => {
  const schema = z.object({ organizationId: z.string().refine(mongoose.isValidObjectId), scope: z.enum(Object.keys(scopeMap)), expiresInDays: z.number().int().min(1).max(90) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Choose a provider, access scope and expiry of up to 90 days' })
  const organizationFilter = { _id: parsed.data.organizationId, status: 'verified' }
  if (config.production) organizationFilter.isDemo = { $ne: true }
  const organization = await Organization.findOne(organizationFilter)
  if (!organization) return res.status(404).json({ error: 'Verified healthcare organization not found' })
  const grant = await ConsentGrant.create({
    patientId: req.user._id,
    organizationId: organization._id,
    scope: scopeMap[parsed.data.scope],
    expiresAt: new Date(Date.now() + parsed.data.expiresInDays * 86400000),
    createdBy: req.user._id,
  })
  try {
    await audit(req, { action: 'consent.granted', resourceType: 'ConsentGrant', resourceId: grant._id, patientId: req.user._id, organizationId: organization._id, metadata: { scope: grant.scope, expiresAt: grant.expiresAt } })
  } catch (error) {
    await ConsentGrant.deleteOne({ _id: grant._id })
    throw error
  }
  res.status(201).json({ grant: { id: grant._id, organization: { id: organization._id, name: organization.name }, scope: grant.scope, expiresAt: grant.expiresAt, active: true } })
}))

router.delete('/consents/:grantId', requireRole('patient'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.grantId)) return res.status(404).json({ error: 'Access grant not found' })
  const grant = await ConsentGrant.findOne({ _id: req.params.grantId, patientId: req.user._id, revokedAt: null })
  if (!grant) return res.status(404).json({ error: 'Access grant not found' })
  grant.revokedAt = new Date()
  await grant.save()
  await audit(req, { action: 'consent.revoked', resourceType: 'ConsentGrant', resourceId: grant._id, patientId: req.user._id, organizationId: grant.organizationId, metadata: { scope: grant.scope } })
  res.json({ ok: true, revokedAt: grant.revokedAt })
}))

export default router
