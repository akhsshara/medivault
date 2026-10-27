import mongoose from 'mongoose'

const { Schema, model } = mongoose

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['patient', 'hospital_staff', 'admin'], required: true, default: 'patient' },
  active: { type: Boolean, default: true, index: true },
  sessionVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetExpiresAt: { type: Date, select: false },
}, { timestamps: true })

const organizationSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 180 },
  type: { type: String, enum: ['hospital', 'clinic', 'laboratory', 'diagnostic_centre'], required: true },
  registrationId: { type: String, trim: true, maxlength: 100 },
  isDemo: { type: Boolean, default: false, index: true },
  status: { type: String, enum: ['pending', 'verified', 'rejected', 'suspended'], default: 'pending', index: true },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: Date,
}, { timestamps: true })

const membershipSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  role: { type: String, enum: ['clinician', 'records_staff', 'organization_admin'], required: true },
  active: { type: Boolean, default: true, index: true },
}, { timestamps: true })
membershipSchema.index({ userId: 1, organizationId: 1 }, { unique: true })

const encounterSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  clinicianId: { type: Schema.Types.ObjectId, ref: 'User' },
  visitDate: { type: Date, required: true, index: true },
  department: { type: String, trim: true, maxlength: 120 },
}, { timestamps: true })

const medicalRecordSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  source: { type: String, enum: ['patient_upload', 'provider_issued'], required: true },
  category: { type: String, enum: ['prescription', 'lab_report', 'scan', 'diagnosis', 'discharge_summary'], required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  visitDate: { type: Date, required: true, index: true },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
  byteSize: { type: Number, required: true, max: 20 * 1024 * 1024 },
  storageKey: { type: String, required: true, unique: true, select: false },
  sha256: { type: String, required: true, select: false },
  verificationStatus: { type: String, enum: ['patient_uploaded', 'provider_verified'], required: true },
}, { timestamps: true })
medicalRecordSchema.index({ patientId: 1, visitDate: -1 })
medicalRecordSchema.index({ organizationId: 1, patientId: 1, visitDate: -1 })

const consentGrantSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  scope: { type: String, enum: ['all', 'prescription', 'lab_report', 'scan', 'diagnosis', 'discharge_summary'], required: true },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: Date,
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true })
consentGrantSchema.index({ patientId: 1, organizationId: 1, expiresAt: 1, revokedAt: 1 })

const auditEventSchema = new Schema({
  actorId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  actorRole: { type: String, enum: ['patient', 'hospital_staff', 'admin', 'system'], required: true },
  action: { type: String, required: true, maxlength: 80, index: true },
  resourceType: { type: String, required: true, maxlength: 60 },
  resourceId: { type: Schema.Types.ObjectId },
  patientId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', index: true },
  outcome: { type: String, enum: ['success', 'denied', 'failure'], default: 'success' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ipAddress: { type: String, maxlength: 64 },
}, { timestamps: true })
auditEventSchema.index({ createdAt: -1 })

const correctionRequestSchema = new Schema({
  patientId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  recordId: { type: Schema.Types.ObjectId, ref: 'MedicalRecord', required: true, index: true },
  reason: { type: String, required: true, trim: true, maxlength: 1000 },
  status: { type: String, enum: ['open', 'reviewing', 'resolved', 'dismissed'], default: 'open' },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String, maxlength: 1000 },
}, { timestamps: true })

export const User = model('User', userSchema)
export const Organization = model('Organization', organizationSchema)
export const OrganizationMembership = model('OrganizationMembership', membershipSchema)
export const Encounter = model('Encounter', encounterSchema)
export const MedicalRecord = model('MedicalRecord', medicalRecordSchema)
export const ConsentGrant = model('ConsentGrant', consentGrantSchema)
export const AuditEvent = model('AuditEvent', auditEventSchema)
export const CorrectionRequest = model('CorrectionRequest', correctionRequestSchema)
