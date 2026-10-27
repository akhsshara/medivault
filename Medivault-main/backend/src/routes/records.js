import crypto from 'node:crypto'
import express from 'express'
import multer from 'multer'
import mongoose from 'mongoose'
import { z } from 'zod'
import { AuditEvent, ConsentGrant, CorrectionRequest, Encounter, MedicalRecord, Organization, User } from '../models.js'
import { activeGrantFor, asyncRoute, audit, canAccessPatientRecord, recordScope } from '../lib.js'
import { requireRole, requireVerifiedHospital } from '../middleware.js'
import { readPrivateBuffer, removePrivateFile, storePrivateBuffer, validFileSignature } from '../storage.js'

const router = express.Router()
const allowedMimeTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 }, fileFilter: (_req, file, callback) => {
  if (!allowedMimeTypes.includes(file.mimetype)) return callback(new Error('Only PDF, JPEG, PNG and WebP files are accepted'))
  callback(null, true)
} })
const recordSchema = z.object({
  title: z.string().trim().min(1).max(180),
  category: z.enum(['prescription', 'lab_report', 'scan', 'diagnosis', 'discharge_summary']),
  visitDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
})
const patientIssueSchema = recordSchema.extend({ patientEmail: z.string().email().max(254), department: z.string().trim().max(120).optional() })

function parseRecordInput(body, schema = recordSchema) {
  const result = schema.safeParse(body)
  if (!result.success) return { error: result.error.issues.map((issue) => issue.message).join('; ') }
  const date = new Date(result.data.visitDate)
  if (Number.isNaN(date.getTime()) || date > new Date(Date.now() + 86400000)) return { error: 'Visit date is invalid' }
  return { data: { ...result.data, visitDate: date } }
}

function publicRecord(record) {
  return {
    id: String(record._id),
    title: record.title,
    category: record.category,
    visitDate: record.visitDate,
    uploadedAt: record.createdAt,
    source: record.source,
    verificationStatus: record.verificationStatus,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    organization: record.organizationId ? { id: String(record.organizationId._id || record.organizationId), name: record.organizationId.name || undefined } : null,
  }
}

async function saveRecord(req, input, { patientId, source, organizationId }) {
  const file = req.file
  if (!file) return { error: 'Choose a medical document to upload' }
  if (!validFileSignature(file.buffer, file.mimetype)) return { error: 'File content does not match a supported document type' }
  const storageKey = await storePrivateBuffer(file.buffer, file.mimetype)
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  let encounter
  let createdRecord
  try {
    if (source === 'provider_issued') encounter = await Encounter.create({ patientId, organizationId, clinicianId: req.user._id, visitDate: input.visitDate, department: input.department })
    createdRecord = await MedicalRecord.create({
      patientId,
      organizationId,
      encounterId: encounter?._id,
      uploadedBy: req.user._id,
      source,
      category: input.category,
      title: input.title,
      visitDate: input.visitDate,
      mimeType: file.mimetype,
      byteSize: file.size,
      storageKey,
      sha256,
      verificationStatus: source === 'provider_issued' ? 'provider_verified' : 'patient_uploaded',
    })
    await audit(req, {
      action: source === 'provider_issued' ? 'record.issued' : 'record.uploaded',
      resourceType: 'MedicalRecord', resourceId: createdRecord._id, patientId, organizationId,
      metadata: { category: createdRecord.category, byteSize: createdRecord.byteSize },
    })
    return { record: createdRecord }
  } catch (error) {
    if (createdRecord) await MedicalRecord.deleteOne({ _id: createdRecord._id })
    if (encounter) await Encounter.deleteOne({ _id: encounter._id })
    await removePrivateFile(storageKey)
    throw error
  }
}

router.get('/', requireRole('patient', 'hospital_staff'), asyncRoute(async (req, res) => {
  const page = Math.max(1, Math.min(10000, Number.parseInt(req.query.page, 10) || 1))
  const limit = Math.max(1, Math.min(100, Number.parseInt(req.query.limit, 10) || 25))
  const filter = {}
  if (req.user.role === 'patient') filter.patientId = req.user._id
  else {
    if (!req.membership) return res.status(403).json({ error: 'A verified hospital membership is required' })
    const grants = await ConsentGrant.find({ organizationId: req.membership.organizationId._id, revokedAt: null, expiresAt: { $gt: new Date() } }).select('patientId scope')
    Object.assign(filter, recordScope(req, grants))
  }
  const category = z.enum(['prescription', 'lab_report', 'scan', 'diagnosis', 'discharge_summary']).safeParse(req.query.category)
  if (req.query.category && !category.success) return res.status(400).json({ error: 'Invalid record category' })
  if (category.success) filter.category = category.data
  if (req.query.from || req.query.to) {
    filter.visitDate = {}
    if (req.query.from && !Number.isNaN(Date.parse(req.query.from))) filter.visitDate.$gte = new Date(req.query.from)
    if (req.query.to && !Number.isNaN(Date.parse(req.query.to))) {
      const upper = new Date(req.query.to)
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(req.query.to))) upper.setUTCHours(23, 59, 59, 999)
      filter.visitDate.$lte = upper
    }
    if (!Object.keys(filter.visitDate).length) delete filter.visitDate
  }
  if (req.query.q) {
    const search = String(req.query.q).trim().slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matchingOrganizations = await Organization.find({ name: { $regex: search, $options: 'i' } }).distinct('_id')
    filter.$and = [...(filter.$and || []), { $or: [{ title: { $regex: search, $options: 'i' } }, { category: { $regex: search, $options: 'i' } }, { organizationId: { $in: matchingOrganizations } }] }]
  }
  const [records, total] = await Promise.all([
    MedicalRecord.find(filter).select('-storageKey -sha256').populate('organizationId', 'name').sort({ visitDate: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    MedicalRecord.countDocuments(filter),
  ])
  await audit(req, {
    action: 'records.listed',
    resourceType: 'MedicalRecord',
    patientId: req.user.role === 'patient' ? req.user._id : undefined,
    organizationId: req.membership?.organizationId?._id,
    metadata: { resultCount: records.length, page, limit },
  })
  res.json({ records: records.map(publicRecord), page, limit, total })
}))

router.post('/', requireRole('patient'), upload.single('file'), asyncRoute(async (req, res) => {
  const parsed = parseRecordInput(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  const result = await saveRecord(req, parsed.data, { patientId: req.user._id, source: 'patient_upload' })
  if (result.error) return res.status(400).json({ error: result.error })
  res.status(201).json({ record: publicRecord(result.record) })
}))

router.get('/:recordId/file', requireRole('patient', 'hospital_staff'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.recordId)) return res.status(404).json({ error: 'Record not found' })
  const record = await MedicalRecord.findById(req.params.recordId).select('+storageKey +sha256')
  if (!record) return res.status(404).json({ error: 'Record not found' })
  if (!(await canAccessPatientRecord(req, record))) {
    await audit(req, { action: 'record.file_access', resourceType: 'MedicalRecord', resourceId: record._id, patientId: record.patientId, organizationId: req.membership?.organizationId?._id, outcome: 'denied' })
    return res.status(404).json({ error: 'Record not found' })
  }
  await audit(req, { action: 'record.file_access', resourceType: 'MedicalRecord', resourceId: record._id, patientId: record.patientId, organizationId: req.membership?.organizationId?._id, metadata: { download: req.query.download === '1' } })
  let buffer
  try { buffer = await readPrivateBuffer(record.storageKey) }
  catch { return res.status(404).json({ error: 'Document is unavailable' }) }
  res.set({ 'Content-Type': record.mimeType, 'Content-Length': String(record.byteSize), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'private, no-store', 'Content-Disposition': `${req.query.download === '1' ? 'attachment' : 'inline'}; filename="medical-record.${record.mimeType === 'application/pdf' ? 'pdf' : record.mimeType.split('/')[1]}"` })
  res.end(buffer)
}))

router.get('/:recordId', requireRole('patient', 'hospital_staff'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.recordId)) return res.status(404).json({ error: 'Record not found' })
  const record = await MedicalRecord.findById(req.params.recordId).populate('organizationId', 'name')
  if (!record || !(await canAccessPatientRecord(req, record))) {
    await audit(req, { action: 'record.view', resourceType: 'MedicalRecord', outcome: 'denied', organizationId: req.membership?.organizationId?._id })
    return res.status(404).json({ error: 'Record not found' })
  }
  await audit(req, { action: 'record.view', resourceType: 'MedicalRecord', resourceId: record._id, patientId: record.patientId, organizationId: req.membership?.organizationId?._id })
  res.json({ record: publicRecord(record) })
}))

router.post('/:recordId/correction-requests', requireRole('patient'), asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.recordId)) return res.status(404).json({ error: 'Record not found' })
  const parsed = z.object({ reason: z.string().trim().min(8).max(1000) }).safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Describe the correction you are requesting (8–1000 characters)' })
  const record = await MedicalRecord.findOne({ _id: req.params.recordId, patientId: req.user._id })
  if (!record) return res.status(404).json({ error: 'Record not found' })
  const correction = await CorrectionRequest.create({ patientId: req.user._id, recordId: record._id, reason: parsed.data.reason })
  await audit(req, { action: 'record.correction_requested', resourceType: 'CorrectionRequest', resourceId: correction._id, patientId: req.user._id, organizationId: record.organizationId })
  res.status(201).json({ request: { id: correction._id, status: correction.status, createdAt: correction.createdAt } })
}))

export const hospitalRecordsRouter = express.Router()
hospitalRecordsRouter.post('/records', requireRole('hospital_staff'), requireVerifiedHospital, upload.single('file'), asyncRoute(async (req, res) => {
  const parsed = parseRecordInput(req.body, patientIssueSchema)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  const patient = await User.findOne({ email: parsed.data.patientEmail.toLowerCase(), role: 'patient', active: true }).select('_id')
  if (!patient) return res.status(404).json({ error: 'Patient account or required authorization was not found' })
  if (!(await activeGrantFor(patient._id, req.membership.organizationId._id, parsed.data.category))) {
    await audit(req, { action: 'record.issue', resourceType: 'MedicalRecord', patientId: patient._id, organizationId: req.membership.organizationId._id, outcome: 'denied', metadata: { category: parsed.data.category } })
    return res.status(404).json({ error: 'Patient account or required authorization was not found' })
  }
  const result = await saveRecord(req, parsed.data, { patientId: patient._id, organizationId: req.membership.organizationId._id, source: 'provider_issued' })
  if (result.error) return res.status(400).json({ error: result.error })
  res.status(201).json({ record: publicRecord(result.record) })
}))

hospitalRecordsRouter.get('/patients/lookup', requireRole('hospital_staff'), requireVerifiedHospital, asyncRoute(async (req, res) => {
  const email = z.string().email().safeParse(req.query.email)
  if (!email.success) return res.status(400).json({ error: 'Provide a valid patient email' })
  const patient = await User.findOne({ email: email.data.toLowerCase(), role: 'patient', active: true }).select('_id name email')
  if (!patient) return res.status(404).json({ error: 'No patient with active consent was found' })
  const consent = await activeGrantFor(patient._id, req.membership.organizationId._id)
  if (!consent) {
    await audit(req, { action: 'patient.lookup', resourceType: 'User', organizationId: req.membership.organizationId._id, outcome: 'denied', metadata: { matchedAccount: true } })
    return res.status(404).json({ error: 'No patient with active consent was found' })
  }
  await audit(req, { action: 'patient.lookup', resourceType: 'User', resourceId: patient._id, patientId: patient._id, organizationId: req.membership.organizationId._id })
  res.json({ patient: { id: patient._id, name: patient.name, email: patient.email } })
}))

hospitalRecordsRouter.get('/patients/:patientId/records', requireRole('hospital_staff'), requireVerifiedHospital, asyncRoute(async (req, res) => {
  if (req.membership.role === 'records_staff') return res.status(403).json({ error: 'This staff role cannot view patient documents' })
  if (!mongoose.isValidObjectId(req.params.patientId)) return res.status(404).json({ error: 'Patient not found' })
  const grants = await ConsentGrant.find({ patientId: req.params.patientId, organizationId: req.membership.organizationId._id, revokedAt: null, expiresAt: { $gt: new Date() } })
  if (!grants.length) {
    await audit(req, { action: 'records.listed', resourceType: 'MedicalRecord', patientId: req.params.patientId, organizationId: req.membership.organizationId._id, outcome: 'denied' })
    return res.status(404).json({ error: 'Patient not found' })
  }
  const scopes = [...new Set(grants.map((grant) => grant.scope))]
  const filter = { patientId: req.params.patientId }
  if (!scopes.includes('all')) filter.category = { $in: scopes }
  const records = await MedicalRecord.find(filter).select('-storageKey -sha256').populate('organizationId', 'name').sort({ visitDate: -1, createdAt: -1 }).limit(100)
  await audit(req, { action: 'records.listed', resourceType: 'MedicalRecord', patientId: req.params.patientId, organizationId: req.membership.organizationId._id, metadata: { resultCount: records.length } })
  res.json({ records: records.map(publicRecord) })
}))

export default router
