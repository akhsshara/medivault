const apiCategory = {
  prescription: ['Prescription', 'lavender', 'rx'],
  lab_report: ['Lab report', 'mint', 'lab'],
  scan: ['Scan', 'blue', 'scan'],
  diagnosis: ['Diagnosis', 'peach', 'heart'],
  discharge_summary: ['Discharge summary', 'peach', 'file'],
}

// Requests are routed to /api on the same origin.
// In development, Vite proxies /api to http://localhost:4000.
// In production, the hosting platform rewrites /api to the backend.
const API_BASE_URL = '/api'

export function apiUrl(path) {
  return `${API_BASE_URL}${path}`
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  let body = options.body
  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }
  const response = await fetch(apiUrl(path), { ...options, body, headers, credentials: 'include' })
  const contentType = response.headers.get('content-type') || ''
  const result = contentType.includes('application/json') ? await response.json() : await response.blob()
  if (!response.ok) throw new Error(result?.error || 'The request could not be completed')
  return result
}

function prettyDate(value) {
  return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fromApiRecord(record) {
  const [type, color, icon] = apiCategory[record.category] || ['Medical record', 'mint', 'lab']
  const visitDate = new Date(record.visitDate)
  return {
    id: record.id,
    title: record.title,
    type,
    apiCategory: record.category,
    date: prettyDate(record.visitDate),
    dateSort: Number.isNaN(visitDate.getTime()) ? '' : visitDate.toISOString().slice(0, 10),
    source: record.organization?.name || (record.source === 'provider_issued' ? 'Healthcare provider' : 'Patient upload'),
    sourceType: record.verificationStatus === 'provider_verified' ? 'verified' : 'personal',
    doctor: record.organization?.name || '',
    detail: record.source === 'provider_issued' ? 'Issued by healthcare provider' : 'Added by you',
    color,
    icon,
    mimeType: record.mimeType,
    byteSize: record.byteSize,
    uploadedAt: record.uploadedAt,
  }
}

export function fromApiGrant(grant) {
  const orgName = grant.organization?.name || 'Healthcare provider'
  const initials = orgName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const scopes = { all: 'All records', prescription: 'Prescriptions', lab_report: 'Lab reports', scan: 'Scans', diagnosis: 'Diagnoses', discharge_summary: 'Discharge summaries' }
  return {
    id: grant.id,
    organizationId: grant.organization?.id,
    hospital: orgName,
    doctor: grant.organization?.isDemo ? 'Sample care team' : 'Verified provider team',
    initials,
    tint: 'sage',
    expires: prettyDate(grant.expiresAt),
    access: scopes[grant.scope] || grant.scope,
    apiScope: grant.scope,
    active: grant.active,
    isDemo: Boolean(grant.organization?.isDemo),
  }
}

export function mapCategoryToApi(category) {
  const map = { 'Lab report': 'lab_report', Prescription: 'prescription', Scan: 'scan', Diagnosis: 'diagnosis', 'Discharge summary': 'discharge_summary' }
  return map[category] || 'lab_report'
}
