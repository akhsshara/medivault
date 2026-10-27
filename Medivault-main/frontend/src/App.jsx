import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays,
  Check, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3,
  Download, FileHeart, FileImage, FilePlus2, FileText, Filter, HeartPulse, Hospital,
  KeyRound, Link2, LockKeyhole, LogOut, MoreHorizontal, Plus, Search, Settings2,
  Shield, ShieldCheck, Share2, SlidersHorizontal, Sparkles, Stethoscope, Upload,
  UserRound, Users, X, Eye, EyeOff, ClipboardList, Building2, BadgeCheck, Trash2,
} from 'lucide-react'
import { apiRequest, apiUrl, fromApiGrant, fromApiRecord, mapCategoryToApi } from './api.js'

const initialRecords = [
  { id: 'MV-240628', title: 'Complete blood count', type: 'Lab report', date: '28 Jun 2026', dateSort: '2026-06-28', source: 'Dr. Lal PathLabs', sourceType: 'verified', doctor: 'Dr. R. Kulkarni', detail: 'Routine health check', color: 'mint', icon: 'lab' },
  { id: 'MV-240619', title: 'Prescription', type: 'Prescription', date: '19 Jun 2026', dateSort: '2026-06-19', source: 'Sahyadri Hospital', sourceType: 'verified', doctor: 'Dr. Meera Joshi', detail: 'Follow-up · Internal medicine', color: 'lavender', icon: 'rx' },
  { id: 'MV-240612', title: 'Chest X-ray', type: 'Scan', date: '12 Jun 2026', dateSort: '2026-06-12', source: 'Deenanath Mangeshkar Hospital', sourceType: 'verified', doctor: 'Radiology department', detail: 'Imaging · PA view', color: 'blue', icon: 'scan' },
  { id: 'MV-240605', title: 'Annual health check-up', type: 'Diagnosis', date: '05 Jun 2026', dateSort: '2026-06-05', source: 'Ruby Hall Clinic', sourceType: 'verified', doctor: 'Dr. A. Shah', detail: 'General medicine', color: 'peach', icon: 'heart' },
  { id: 'MV-240520', title: 'Prescription', type: 'Prescription', date: '20 May 2026', dateSort: '2026-05-20', source: 'Sahyadri Hospital', sourceType: 'verified', doctor: 'Dr. Meera Joshi', detail: 'Consultation · Internal medicine', color: 'lavender', icon: 'rx' },
  { id: 'MV-240505', title: 'Lipid profile', type: 'Lab report', date: '05 May 2026', dateSort: '2026-05-05', source: 'Dr. Lal PathLabs', sourceType: 'verified', doctor: 'Dr. R. Kulkarni', detail: 'Preventive care', color: 'mint', icon: 'lab' },
  { id: 'MV-240421', title: 'Discharge summary', type: 'Discharge summary', date: '21 Apr 2026', dateSort: '2026-04-21', source: 'Sahyadri Hospital', sourceType: 'verified', doctor: 'Dr. N. Patil', detail: 'Inpatient · Orthopaedics', color: 'peach', icon: 'file' },
  { id: 'MV-240318', title: 'MRI lumbar spine', type: 'Scan', date: '18 Mar 2026', dateSort: '2026-03-18', source: 'Deenanath Mangeshkar Hospital', sourceType: 'verified', doctor: 'Radiology department', detail: 'Imaging · Lumbar spine', color: 'blue', icon: 'scan' },
  { id: 'MV-240225', title: 'Blood glucose report', type: 'Lab report', date: '25 Feb 2026', dateSort: '2026-02-25', source: 'Patient upload', sourceType: 'personal', doctor: '', detail: 'Added by you', color: 'mint', icon: 'lab' },
]

const initialShares = [
  { id: 1, hospital: 'MediVault Demo Clinic', doctor: 'Sample care team', initials: 'DC', tint: 'sage', expires: '12 Nov 2026', access: 'Lab reports', active: true, isDemo: true },
  { id: 2, hospital: 'MediVault Demo Diagnostics', doctor: 'Sample diagnostics team', initials: 'DD', tint: 'rose', expires: '02 Nov 2026', access: 'All records', active: true, isDemo: true },
  { id: 3, hospital: 'MediVault Demo Imaging Centre', doctor: 'Sample imaging team', initials: 'DI', tint: 'blue', expires: '18 Sep 2026', access: 'Imaging records', active: false, isDemo: true },
]

const initialOrganizations = [
  { id: null, name: 'MediVault Demo Clinic', doctor: 'Sample care team', initials: 'DC', tint: 'sage', isDemo: true },
  { id: null, name: 'MediVault Demo Diagnostics', doctor: 'Sample diagnostics team', initials: 'DD', tint: 'rose', isDemo: true },
  { id: null, name: 'MediVault Demo Imaging Centre', doctor: 'Sample imaging team', initials: 'DI', tint: 'blue', isDemo: true },
]

const categoryFilters = ['All records', 'Prescriptions', 'Lab reports', 'Scans', 'Diagnoses', 'Discharge summaries']
const categoryMap = { Prescriptions: 'Prescription', 'Lab reports': 'Lab report', Scans: 'Scan', Diagnoses: 'Diagnosis', 'Discharge summaries': 'Discharge summary' }

function RecordIcon({ record, size = 19 }) {
  const Icon = record.icon === 'rx' ? FileText : record.icon === 'scan' ? FileImage : record.icon === 'heart' ? HeartPulse : record.icon === 'file' ? ClipboardList : Activity
  return <span className={`record-icon ${record.color}`}><Icon size={size} strokeWidth={1.8} /></span>
}

function Modal({ title, eyebrow, onClose, children, width = '560px' }) {
  return <div className="modal-shade" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="modal-card" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
      <button className="modal-close" aria-label="Close" onClick={onClose}><X size={19} /></button>
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h2>{title}</h2>
      {children}
    </section>
  </div>
}

export default function App() {
  const [records, setRecords] = useState(initialRecords)
  const [timelineRecords, setTimelineRecords] = useState(initialRecords)
  const [recordTotal, setRecordTotal] = useState(initialRecords.length)
  const [recordPage, setRecordPage] = useState(1)
  const [shares, setShares] = useState(initialShares)
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [page, setPage] = useState('Overview')
  const [role, setRole] = useState('Patient portal')
  const [session, setSession] = useState(null)
  const [demoMode, setDemoMode] = useState(false)
  const [roleMenu, setRoleMenu] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All records')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [modal, setModal] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('signin')
  const [authEmail, setAuthEmail] = useState('')
  const [authName, setAuthName] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [selectedOrg, setSelectedOrg] = useState(initialOrganizations[0].name)
  const [shareScope, setShareScope] = useState('All records')
  const [shareExpiry, setShareExpiry] = useState('30 days')
  const [notice, setNotice] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadCategory, setUploadCategory] = useState('Lab report')
  const [uploadError, setUploadError] = useState('')
  const [apiBusy, setApiBusy] = useState(false)
  const fileInput = useRef(null)

  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get('token')
    if (resetToken) setAuthMode('reset')
    else apiRequest('/auth/me').then(({ user, organization }) => activateSession(user, organization)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!session || session.role !== 'patient' || page !== 'Medical timeline') return
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ page: String(recordPage), limit: '25' })
      if (query.trim()) params.set('q', query.trim())
      if (category !== 'All records') params.set('category', mapCategoryToApi(categoryMap[category]))
      if (dateFrom) params.set('from', dateFrom)
      if (dateTo) params.set('to', dateTo)
      apiRequest(`/records?${params.toString()}`).then((result) => {
        setTimelineRecords(result.records.map(fromApiRecord))
        setRecordTotal(result.total)
      }).catch((error) => announce(error.message))
    }, 220)
    return () => window.clearTimeout(timer)
  }, [session, page, recordPage, query, category, dateFrom, dateTo])

  async function refreshConnectedData(user = session) {
    if (!user) return
    if (user.role === 'patient') {
      const [recordResult, consentResult, orgResult] = await Promise.all([apiRequest('/records'), apiRequest('/consents'), apiRequest('/organizations')])
      setRecords(recordResult.records.map(fromApiRecord))
      setTimelineRecords(recordResult.records.map(fromApiRecord))
      setRecordTotal(recordResult.total)
      setShares(consentResult.grants.map(fromApiGrant))
      const mappedOrganizations = orgResult.organizations.map((org) => ({ id: org.id, name: org.name, doctor: org.isDemo ? 'Sample care team' : 'Verified provider team', initials: org.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), tint: 'sage', isDemo: Boolean(org.isDemo) }))
      setOrganizations(mappedOrganizations)
      if (mappedOrganizations.length) setSelectedOrg(mappedOrganizations[0].id)
    } else if (user.role === 'hospital_staff') {
      const recordResult = await apiRequest('/records')
      setRecords(recordResult.records.map(fromApiRecord))
      setTimelineRecords(recordResult.records.map(fromApiRecord))
      setRecordTotal(recordResult.total)
    }
  }

  async function activateSession(user, organizationFromMe = null) {
    let organization = organizationFromMe
    if (!organization && user.role === 'hospital_staff') {
      try { organization = (await apiRequest('/auth/me')).organization } catch { organization = null }
    }
    const account = { ...user, organization }
    setSession(account)
    setDemoMode(false)
    const nextRole = user.role === 'patient' ? 'Patient portal' : user.role === 'hospital_staff' ? 'Provider portal' : 'Admin console'
    setRole(nextRole)
    setPage(nextRole === 'Patient portal' ? 'Overview' : nextRole === 'Provider portal' ? 'Provider overview' : 'Organizations')
    setQuery(''); setCategory('All records'); setDateFrom(''); setDateTo(''); setRecordPage(1)
    setAuthOpen(false)
    setAuthError('')
    refreshConnectedData(account).catch((error) => announce(error.message))
  }

  async function submitAuth(event) {
    event.preventDefault()
    setAuthBusy(true)
    setAuthError('')
    try {
      if (authMode === 'reset') {
        const token = new URLSearchParams(window.location.search).get('token')
        if (!token) throw new Error('Open the password reset link from your email to continue')
        await apiRequest('/auth/reset-password', { method: 'POST', body: { token, password: authPassword } })
        window.history.replaceState({}, '', window.location.pathname)
        setAuthMode('signin')
        setAuthPassword('')
        setAuthError('Your password is updated. Sign in with the new password.')
      } else if (authMode === 'forgot') {
        const response = await apiRequest('/auth/forgot-password', { method: 'POST', body: { email: authEmail } })
        setAuthError(response.message)
      } else {
        const route = authMode === 'register' ? '/auth/register' : '/auth/login'
        const body = authMode === 'register' ? { name: authName, email: authEmail, password: authPassword } : { email: authEmail, password: authPassword }
        const { user } = await apiRequest(route, { method: 'POST', body })
        setAuthPassword('')
        await activateSession(user)
      }
    } catch (error) { setAuthError(error.message) }
    finally { setAuthBusy(false) }
  }

  async function signOut() {
    try { await apiRequest('/auth/logout', { method: 'POST' }) } catch { /* expired sessions can still return to the demo */ }
    setSession(null)
    setDemoMode(false)
    setRole('Patient portal')
    setRecords(initialRecords)
    setTimelineRecords(initialRecords)
    setRecordTotal(initialRecords.length)
    setShares(initialShares)
    setOrganizations(initialOrganizations)
    setPage('Overview')
    setQuery(''); setCategory('All records'); setDateFrom(''); setDateTo(''); setRecordPage(1)
    setProfileMenu(false)
    announce('Signed out of your account')
  }

  async function updateProfile(name) {
    if (!session) return
    const { user } = await apiRequest('/profile', { method: 'PATCH', body: { name } })
    setSession((current) => ({ ...current, ...user }))
    announce('Profile updated')
  }

  const filteredRecords = useMemo(() => timelineRecords.filter((record) => {
    const matchesCategory = category === 'All records' || record.type === categoryMap[category]
    const haystack = `${record.title} ${record.type} ${record.source} ${record.doctor} ${record.id}`.toLowerCase()
    const matchesFrom = !dateFrom || record.dateSort >= dateFrom
    const matchesTo = !dateTo || record.dateSort <= dateTo
    return matchesCategory && matchesFrom && matchesTo && haystack.includes(query.toLowerCase().trim())
  }).sort((a, b) => b.dateSort.localeCompare(a.dateSort)), [timelineRecords, category, query, dateFrom, dateTo])

  function announce(message) {
    setNotice(message)
    window.setTimeout(() => setNotice(''), 3500)
  }

  function showRecord(record) {
    setSelectedRecord(record)
    setModal('record')
  }

  async function saveDownload(record) {
    if (session) {
      try {
        const blob = await apiRequest(`/records/${record.id}/file?download=1`)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = `${record.title.toLowerCase().replaceAll(' ', '-')}`
        anchor.click()
        URL.revokeObjectURL(url)
        announce('Secure document downloaded')
      } catch (error) { announce(error.message) }
      return
    }
    const body = `MediVault demo record\n${record.title}\nDate: ${record.date}\nProvider: ${record.source}\nClinician: ${record.doctor || 'Not specified'}\n\nThis is synthetic demonstration data. It is not a medical document and must not be used for clinical care.`
    const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${record.title.toLowerCase().replaceAll(' ', '-')}-demo.txt`
    anchor.click()
    URL.revokeObjectURL(url)
    announce('Demo summary downloaded')
  }

  function chooseFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) { setUploadError('Choose a PDF, JPG, PNG or WebP file.'); return }
    if (file.size > 20 * 1024 * 1024) { setUploadError('Files must be 20 MB or smaller.'); return }
    setUploadError('')
    setUploadFile(file)
    if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, '').replaceAll('-', ' '))
  }

  async function addUpload(event) {
    event.preventDefault()
    if (!uploadFile) { setUploadError('Choose a file to continue.'); return }
    if (session) {
      setApiBusy(true)
      try {
        const form = new FormData()
        form.append('file', uploadFile)
        form.append('title', uploadTitle || uploadFile.name)
        form.append('category', mapCategoryToApi(uploadCategory))
        form.append('visitDate', new Date().toISOString())
        const { record } = await apiRequest('/records', { method: 'POST', body: form })
        const savedRecord = fromApiRecord(record)
        setRecords((current) => [savedRecord, ...current])
        setTimelineRecords((current) => [savedRecord, ...current])
        setRecordTotal((current) => current + 1)
        setUploadFile(null)
        setUploadTitle('')
        setModal(null)
        setPage('Medical timeline')
        announce('Medical document securely uploaded')
      } catch (error) { setUploadError(error.message) }
      finally { setApiBusy(false) }
      return
    }
    const today = new Date()
    const date = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    const newRecord = { id: `MV-${Date.now().toString().slice(-6)}`, title: uploadTitle || uploadFile.name, type: uploadCategory, date, dateSort: today.toISOString().slice(0, 10), source: 'Patient upload', sourceType: 'personal', doctor: '', detail: 'Added by you', color: uploadCategory === 'Scan' ? 'blue' : uploadCategory === 'Prescription' ? 'lavender' : 'mint', icon: uploadCategory === 'Scan' ? 'scan' : uploadCategory === 'Prescription' ? 'rx' : 'lab', fileName: uploadFile.name, fileSize: uploadFile.size }
    setRecords((current) => [newRecord, ...current])
    setTimelineRecords((current) => [newRecord, ...current])
    setRecordTotal((current) => current + 1)
    setUploadFile(null)
    setUploadTitle('')
    setModal(null)
    setPage('Medical timeline')
    announce('Added to your demo timeline')
  }

  async function grantShare(event) {
    event.preventDefault()
    const days = Number.parseInt(shareExpiry, 10) || 30
    const org = organizations.find((item) => (item.id || item.name) === selectedOrg) || organizations[0]
    if (!org) { announce('No providers are available yet. Please try again shortly.'); return }
    if (session) {
      setApiBusy(true)
      const scope = { 'Selected records': 'all', 'All records': 'all', 'Lab reports': 'lab_reports', 'Imaging records': 'scans' }[shareScope] || 'all'
      try {
        await apiRequest('/consents', { method: 'POST', body: { organizationId: org.id || selectedOrg, scope, expiresInDays: days } })
        const { grants } = await apiRequest('/consents')
        setShares(grants.map(fromApiGrant))
        setModal(null)
        setPage('Sharing & access')
        announce(org.isDemo ? `Demo consent saved for ${org.name}. No provider can access these sample entries.` : `Access granted to ${org.name}`)
      } catch (error) { announce(error.message) }
      finally { setApiBusy(false) }
      return
    }
    const expires = new Date(Date.now() + days * 86400000).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    setShares((current) => [{ ...org, id: Date.now(), access: shareScope, expires, active: true }, ...current])
    setModal(null)
    setPage('Sharing & access')
    announce(org.isDemo ? `Demo consent saved for ${org.name}. No provider can access these sample entries.` : `Access granted to ${org.name}`)
  }

  async function revokeShare(id) {
    if (session) {
      try {
        await apiRequest(`/consents/${id}`, { method: 'DELETE' })
        setShares((current) => current.map((item) => item.id === id ? { ...item, active: false } : item))
        announce('Access revoked immediately')
      } catch (error) { announce(error.message) }
      return
    }
    setShares((current) => current.map((item) => item.id === id ? { ...item, active: false } : item))
    announce('Access revoked immediately')
  }

  function switchRole(nextRole) {
    if (session) return
    setRole(nextRole)
    setRoleMenu(false)
    setPage(nextRole === 'Patient portal' ? 'Overview' : nextRole === 'Provider portal' ? 'Provider overview' : 'Organizations')
  }

  const isPatient = role === 'Patient portal'
  const personName = session?.name || 'Ananya Rao'
  const personInitials = personName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const chosenOrganization = organizations.find((item) => (item.id || item.name) === selectedOrg) || organizations[0]

  const authEyebrow = authMode === 'register' ? 'CREATE YOUR VAULT' : authMode === 'forgot' || authMode === 'reset' ? 'ACCOUNT RECOVERY' : 'WELCOME BACK'
  const authTitle = authMode === 'register' ? 'Create your account' : authMode === 'forgot' ? 'Reset your password' : authMode === 'reset' ? 'Choose a new password' : 'Sign in to MediVault'
  const authContent = <>
    <p className="modal-intro">{authMode === 'register' ? 'Start organizing your health records in one place.' : authMode === 'forgot' ? 'We’ll send a recovery link if an account matches your email.' : authMode === 'reset' ? 'Choose a strong password for your account.' : 'Access your private health record.'}</p>
    <form onSubmit={submitAuth} className="auth-form">
      {authMode === 'register' && <label>Full name<input autoComplete="name" required minLength="2" maxLength="120" value={authName} onChange={(e) => setAuthName(e.target.value)} placeholder="Your name" /></label>}
      {authMode !== 'reset' && <label>Email address<input type="email" autoComplete="email" required value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} placeholder="you@example.com" /></label>}
      {authMode !== 'forgot' && <label>{authMode === 'reset' ? 'New password' : 'Password'}<input type="password" autoComplete={authMode === 'register' || authMode === 'reset' ? 'new-password' : 'current-password'} required minLength="12" maxLength="128" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} placeholder="At least 12 characters" /></label>}
      {authError && <div className="auth-message" role="status">{authError}</div>}
      <button className="button primary auth-submit" disabled={authBusy} type="submit">{authBusy ? 'Please wait…' : authMode === 'register' ? 'Create account' : authMode === 'forgot' ? 'Send recovery link' : authMode === 'reset' ? 'Update password' : 'Sign in'}</button>
    </form>
    <div className="auth-links">{authMode === 'signin' && <><button onClick={() => { setAuthMode('forgot'); setAuthError('') }}>Forgot password?</button><span>New to MediVault?</span><button onClick={() => { setAuthMode('register'); setAuthError('') }}>Create an account</button></>}{authMode !== 'signin' && <button onClick={() => { setAuthMode('signin'); setAuthError('') }}>Back to sign in</button>}</div>
  </>

  if (!session && !demoMode) return <main className="auth-landing">
    <div className="auth-landing-shell">
      <section className="auth-hero">
        <div className="auth-brand-lockup"><span className="brand-mark"><FileHeart size={21} strokeWidth={2.2} /></span><span className="brand-word">medi<span>vault</span></span></div>
        <div className="auth-hero-copy">
          <span className="auth-hero-kicker"><LockKeyhole size={14} /> PRIVATE BY DESIGN</span>
          <h2>Your health records, together.</h2>
          <p>One secure place for your reports, prescriptions and care history. You decide what to share and with whom.</p>
          <div className="auth-hero-points"><span><CheckCircle2 size={16} />Your records, organized</span><span><CheckCircle2 size={16} />You control access</span></div>
        </div>
        <div className="auth-hero-card" aria-hidden="true"><div className="auth-hero-card-heading"><span className="auth-hero-card-icon"><Activity size={17} /></span><span><strong>Health timeline</strong><small>Your records in one place</small></span><span className="auth-hero-card-status">PRIVATE</span></div><div className="auth-hero-record"><span className="auth-hero-record-icon mint"><Activity size={15} /></span><span><strong>Complete blood count</strong><small>Lab report · 28 Jun 2026</small></span><CheckCircle2 size={16} /></div><div className="auth-hero-record"><span className="auth-hero-record-icon lavender"><FileText size={15} /></span><span><strong>Prescription</strong><small>Sahyadri Hospital · 19 Jun 2026</small></span><CheckCircle2 size={16} /></div><div className="auth-hero-consent"><ShieldCheck size={16} /><span>Sharing is always your choice</span><ArrowRight size={15} /></div></div>
        <div className="auth-hero-footer"><span>MADE FOR CARE THAT CONNECTS</span><span>MEDIVAULT · DEMO</span></div>
      </section>
      <section className="auth-side">
        <div className="auth-card">
          <div className="eyebrow">{authEyebrow}</div>
          <h1>{authTitle}</h1>
          {authContent}
          {authMode === 'signin' && <button className="auth-demo-link" onClick={() => { setDemoMode(true); setAuthError('') }}>Explore the demo with synthetic data <ArrowRight size={15} /></button>}
        </div>
        <p className="auth-side-note"><LockKeyhole size={14} /> This demo uses synthetic data. Never enter real medical information.</p>
      </section>
    </div>
  </main>

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-row"><div className="brand-mark"><FileHeart size={21} strokeWidth={2.2} /></div><span className="brand-word">medi<span>vault</span></span><span className="brand-beta">{session ? 'LIVE' : 'DEMO'}</span></div>
      <button className="workspace-picker" onClick={() => setRoleMenu((open) => !open)} aria-expanded={roleMenu}>
        <span className={`workspace-symbol ${isPatient ? '' : 'provider'}`}>{isPatient ? <UserRound size={17} /> : role === 'Admin console' ? <ShieldCheck size={17} /> : <Hospital size={17} />}</span>
        <span className="workspace-copy"><strong>{role}</strong><small>{isPatient ? personName : role === 'Admin console' ? 'MediVault team' : session?.organization?.name || 'Sahyadri Hospital'}</small></span><ChevronDown size={16} className="muted" />
      </button>
      {roleMenu && <div className="role-menu">{(session ? [role] : ['Patient portal', 'Provider portal', 'Admin console']).map((item) => <button key={item} onClick={() => switchRole(item)} className={role === item ? 'selected' : ''}>{item === 'Patient portal' ? <UserRound size={16} /> : item === 'Provider portal' ? <Hospital size={16} /> : <Shield size={16} />}{item}{role === item && <Check size={15} />}</button>)}</div>}

      {isPatient ? <>
        <div className="nav-label">YOUR HEALTH</div>
        <nav className="nav-list">
          <button className={`nav-item ${page === 'Overview' ? 'active' : ''}`} onClick={() => setPage('Overview')}><Activity size={18} />Overview</button>
          <button className={`nav-item ${page === 'Medical timeline' ? 'active' : ''}`} onClick={() => setPage('Medical timeline')}><CalendarDays size={18} />Medical timeline<span className="nav-count">{records.length}</span></button>
          <button className={`nav-item ${page === 'Sharing & access' ? 'active' : ''}`} onClick={() => setPage('Sharing & access')}><Share2 size={18} />Sharing & access<span className="nav-dot" /></button>
        </nav>
        <div className="nav-label second-label">PREFERENCES</div>
        <nav className="nav-list">
          <button className={`nav-item ${page === 'Profile & settings' ? 'active' : ''}`} onClick={() => setPage('Profile & settings')}><Settings2 size={18} />Profile & settings</button>
          <button className="nav-item" onClick={() => announce('Help centre is part of the product roadmap')}><CircleHelp size={18} />Help centre</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><span className="privacy-icon"><LockKeyhole size={17} /></span><div><strong>Your records stay yours</strong><p>You choose what to share, and with whom.</p></div><button onClick={() => setPage('Sharing & access')} aria-label="Manage sharing"><ArrowRight size={15} /></button></div>
          <button className="sidebar-profile" onClick={() => setProfileMenu((open) => !open)}><span className="avatar">{personInitials}</span><span className="profile-copy"><strong>{personName}</strong><small>{session ? 'Secure account' : 'Personal account'}</small></span><MoreHorizontal size={20} /></button>
          {profileMenu && <div className="profile-popover"><button onClick={() => { setPage('Profile & settings'); setProfileMenu(false) }}><Settings2 size={15} />Account settings</button><button onClick={() => announce('You are viewing a local synthetic demo')}><LogOut size={15} />Demo session details</button></div>}
        </div>
      </> : role === 'Provider portal' ? <>
        <div className="nav-label">WORKSPACE</div>
        <nav className="nav-list"><button className={`nav-item ${page === 'Provider overview' ? 'active' : ''}`} onClick={() => setPage('Provider overview')}><Activity size={18} />Overview</button><button className={`nav-item ${page === 'Patient records' ? 'active' : ''}`} onClick={() => setPage('Patient records')}><Users size={18} />Patient records</button><button className={`nav-item ${page === 'Issue a document' ? 'active' : ''}`} onClick={() => setPage('Issue a document')}><FilePlus2 size={18} />Issue a document</button><button className={`nav-item ${page === 'Access log' ? 'active' : ''}`} onClick={() => setPage('Access log')}><ClipboardList size={18} />Access log</button></nav>
        <div className="provider-side-note"><span className="verified-icon"><BadgeCheck size={17} /></span><div><strong>{session?.organization ? 'Verified organization' : session ? 'Membership required' : 'Verified organization'}</strong><p>{session?.organization?.name || (session ? 'Ask an admin to verify access' : 'Sahyadri Hospital demo')}</p></div></div>
      </> : <>
        <div className="nav-label">ADMINISTRATION</div>
        <nav className="nav-list"><button className={`nav-item ${page === 'Organizations' ? 'active' : ''}`} onClick={() => setPage('Organizations')}><Building2 size={18} />Organizations<span className="nav-count">4</span></button><button className={`nav-item ${page === 'Staff accounts' ? 'active' : ''}`} onClick={() => setPage('Staff accounts')}><Users size={18} />Staff accounts</button><button className={`nav-item ${page === 'Correction requests' ? 'active' : ''}`} onClick={() => setPage('Correction requests')}><ClipboardList size={18} />Correction requests</button><button className={`nav-item ${page === 'Platform audit' ? 'active' : ''}`} onClick={() => setPage('Platform audit')}><Shield size={18} />Platform audit</button></nav>
        <div className="provider-side-note"><span className="verified-icon"><ShieldCheck size={17} /></span><div><strong>Admin workspace</strong><p>Demo environment</p></div></div>
      </>}
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="mobile-brand"><div className="brand-mark"><FileHeart size={18} /></div><span className="brand-word">medi<span>vault</span></span></div><div className="breadcrumb"><span>{role}</span><ChevronRight size={14} /><strong>{page}</strong></div><div className="top-actions">{session ? <span className="demo-pill live-pill"><span />Secure account</span> : <span className="demo-pill"><span />Synthetic demo data</span>}<button className="icon-button notification-button" onClick={() => announce('You’re all caught up')} aria-label="Notifications"><Bell size={18} /><i /></button>{session && <button className="signout-top" onClick={signOut} title="Sign out"><LogOut size={16} /></button>}{!session && <button className="button secondary sign-in-button" onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthOpen(true) }}>Sign in</button>}<span className="top-divider" /><button className="top-user" onClick={() => setProfileMenu((open) => !open)}><span className="avatar small-avatar">{session ? personInitials : isPatient ? 'AR' : role === 'Admin console' ? 'MV' : 'SH'}</span><ChevronDown size={15} /></button></div></header>

      <div className="page-content">
        {isPatient ? page === 'Overview' ? <PatientOverview records={records} shares={shares} live={Boolean(session)} total={recordTotal} onUpload={() => { setUploadFile(null); setUploadError(''); setModal('upload') }} onOpenRecord={showRecord} onPage={setPage} /> : page === 'Medical timeline' ? <Timeline records={filteredRecords} total={session ? recordTotal : filteredRecords.length} live={Boolean(session)} pageNumber={recordPage} setPageNumber={setRecordPage} query={query} setQuery={(value) => { setQuery(value); setRecordPage(1) }} category={category} setCategory={(value) => { setCategory(value); setRecordPage(1) }} dateFrom={dateFrom} setDateFrom={(value) => { setDateFrom(value); setRecordPage(1) }} dateTo={dateTo} setDateTo={(value) => { setDateTo(value); setRecordPage(1) }} showFilters={showFilters} setShowFilters={setShowFilters} onOpen={showRecord} onUpload={() => { setUploadFile(null); setUploadError(''); setModal('upload') }} onDownload={saveDownload} /> : page === 'Sharing & access' ? <Sharing shares={shares} onNew={() => setModal('share')} onRevoke={revokeShare} /> : <SettingsPage announce={announce} session={session} onProfileUpdate={updateProfile} onPasswordRecovery={() => { setAuthMode('forgot'); setAuthEmail(session?.email || ''); setAuthError(''); setAuthOpen(true) }} /> : role === 'Provider portal' ? <ProviderPage page={page} records={records} announce={announce} live={Boolean(session)} onRefresh={() => refreshConnectedData()} organization={session?.organization} /> : <AdminPage page={page} announce={announce} live={Boolean(session)} />}
      </div>
      <footer className="page-footer"><span>© 2026 MediVault</span><span><LockKeyhole size={13} />Built for privacy · {session ? 'Secure account' : 'Demo environment'}</span><button onClick={() => announce('Privacy information is available in the project documentation')}>Privacy</button></footer>
    </main>

    {authOpen && <Modal eyebrow={authEyebrow} title={authTitle} onClose={() => setAuthOpen(false)} width="440px">{authContent}</Modal>}

    {modal === 'upload' && <Modal eyebrow="ADD TO YOUR VAULT" title="Upload a medical record" onClose={() => setModal(null)}>
      <p className="modal-intro">Keep your health documents together. Only you can see files you upload here.</p>
      <form onSubmit={addUpload}>
        <div className="upload-drop" onClick={() => fileInput.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const file = e.dataTransfer.files?.[0]; if (file) { const fakeEvent = { target: { files: [file] } }; chooseFile(fakeEvent) } }}>
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" hidden onChange={chooseFile} />
          <div className="upload-circle"><Upload size={20} /></div>
          {uploadFile ? <><strong>{uploadFile.name}</strong><span>{(uploadFile.size / 1024 / 1024).toFixed(2)} MB · Click to change</span></> : <><strong>Drop a file here, or <em>browse</em></strong><span>PDF, JPG, PNG or WebP · Up to 20 MB</span></>}
        </div>
        <div className="form-grid"><label>Document name<input required value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} placeholder="e.g. Annual blood test" /></label><label>Record type<select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)}><option>Lab report</option><option>Prescription</option><option>Scan</option><option>Diagnosis</option><option>Discharge summary</option></select></label></div>
        {uploadError && <p className="field-error">{uploadError}</p>}
        <div className="local-note"><ShieldCheck size={16} /><span>{session ? 'Files are validated and stored in the private server storage area. Your upload is not publicly accessible.' : 'This demo keeps the selected file in this browser session only. Sign in to securely upload a real file to your private account.'}</span></div>
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={apiBusy} type="submit"><Upload size={16} />{apiBusy ? 'Uploading…' : 'Add record'}</button></div>
      </form>
    </Modal>}

    {modal === 'share' && <Modal eyebrow="CONSENT & ACCESS" title="Share records securely" onClose={() => setModal(null)}>
      <p className="modal-intro">Give a verified care team time-limited access. You can revoke it at any time.</p>
      <form onSubmit={grantShare}>
        <label className="full-label">Healthcare provider<select value={selectedOrg} onChange={(e) => setSelectedOrg(e.target.value)}>{organizations.map((org) => <option value={org.id || org.name} key={org.id || org.name}>{org.name}{org.isDemo ? ' · demo sample' : ''}</option>)}</select></label>
        {chosenOrganization && <div className="share-recipient"><span className={`org-avatar ${chosenOrganization.tint}`}>{chosenOrganization.initials}</span><div><strong>{chosenOrganization.name}</strong><span>{chosenOrganization.isDemo ? 'Demo sample · no real provider can access your records' : `${chosenOrganization.doctor} · Verified provider`}</span></div>{chosenOrganization.isDemo ? <Sparkles size={17} /> : <BadgeCheck size={17} className="verify-green" />}</div>}
        <div className="form-grid"><label>Records they can see<select value={shareScope} onChange={(e) => setShareScope(e.target.value)}><option>All records</option><option>Lab reports</option><option>Imaging records</option></select></label><label>Access expires<select value={shareExpiry} onChange={(e) => setShareExpiry(e.target.value)}><option value="7 days">7 days</option><option value="30 days">30 days</option><option value="90 days">90 days</option></select></label></div>
        <div className="consent-callout"><LockKeyhole size={17} /><span>{chosenOrganization?.isDemo ? 'Demo grants are saved for this account so you can try the flow. No healthcare provider account receives access.' : 'Access is logged. The provider cannot see records outside this grant, and revocation takes effect immediately.'}</span></div>
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setModal(null)}>Cancel</button><button className="button primary" disabled={apiBusy || !organizations.length} type="submit"><Share2 size={16} />{apiBusy ? 'Saving…' : 'Grant access'}</button></div>
      </form>
    </Modal>}

    {modal === 'record' && selectedRecord && <Modal eyebrow={selectedRecord.type.toUpperCase()} title={selectedRecord.title} onClose={() => setModal(null)} width="620px">
      <div className="detail-source"><RecordIcon record={selectedRecord} size={22} /><div><strong>{selectedRecord.source}</strong><span>{selectedRecord.doctor || selectedRecord.detail} · {selectedRecord.date}</span></div><span className={`source-badge ${selectedRecord.sourceType}`}>{selectedRecord.sourceType === 'verified' ? <><BadgeCheck size={13} />Verified source</> : <><UserRound size={13} />Your upload</>}</span></div>
      {session ? <div className="live-document-preview">{selectedRecord.mimeType?.startsWith('image/') ? <img src={apiUrl(`/records/${selectedRecord.id}/file`)} alt={`Preview of ${selectedRecord.title}`} /> : <iframe src={apiUrl(`/records/${selectedRecord.id}/file`)} title={`Preview of ${selectedRecord.title}`} />}</div> : <div className="detail-demo"><Sparkles size={17} /><div><strong>Sample record</strong><p>This demonstration uses synthetic health record metadata only. No clinical document is attached to this sample.</p></div></div>}
      <div className="detail-meta"><div><span>RECORD ID</span><strong>{selectedRecord.id}</strong></div><div><span>DOCUMENT TYPE</span><strong>{selectedRecord.type}</strong></div><div><span>VISIT / DOCUMENT DATE</span><strong>{selectedRecord.date}</strong></div><div><span>ADDED TO MEDIVAULT</span><strong>{selectedRecord.date}</strong></div></div>
      <div className="modal-actions detail-actions">{session && <button className="button secondary" onClick={async () => { const reason = window.prompt('Tell us what needs correcting. This request goes to the MediVault support team.'); if (!reason) return; try { await apiRequest(`/records/${selectedRecord.id}/correction-requests`, { method: 'POST', body: { reason } }); announce('Correction request submitted'); } catch (error) { announce(error.message) } }}><ClipboardList size={16} />Request correction</button>}<button className="button secondary" onClick={() => { setModal(null); setModal('share') }}><Share2 size={16} />Share access</button><button className="button primary" onClick={() => saveDownload(selectedRecord)}><Download size={16} />{session ? 'Download document' : 'Download sample'}</button></div>
    </Modal>}

    {notice && <div className="toast"><CheckCircle2 size={17} />{notice}<button onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
  </div>
}

function PatientOverview({ records, shares, live, total, onUpload, onOpenRecord, onPage }) {
  const recent = records.slice().sort((a, b) => b.dateSort.localeCompare(a.dateSort)).slice(0, 4)
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).toUpperCase()
  const sourceCount = new Set(records.map((record) => record.source)).size
  return <>
    <div className="welcome-row"><div><div className="eyebrow">{today}</div><h1>Your health, <span>all together.</span></h1><p className="page-subtitle">A clearer view of your health history starts here.</p></div><button className="button primary upload-main" onClick={onUpload}><Plus size={17} />Add a record</button></div>
    <div className="welcome-ribbon"><div className="ribbon-symbol"><HeartPulse size={22} /></div><div><strong>Your health record is taking shape</strong><p>Every prescription, report and visit — organized in one place, ready when you need it.</p></div><div className="ribbon-progress"><div className="ribbon-progress-number">{records.length}<span> records</span></div><div className="progress-track"><span style={{ width: `${Math.min(85, records.length * 7)}%` }} /></div><small>Keep adding to build your timeline</small></div><div className="ribbon-ornament"><Activity size={98} strokeWidth={1} /></div></div>
    <div className="stats-grid">
      <StatCard icon={<FileText size={18} />} title="Records in your vault" value={(live ? total : records.length).toString()} foot={live ? `From ${sourceCount} record sources` : 'Across 4 demo providers'} tone="green" />
      <StatCard icon={<Clock3 size={18} />} title="Last added" value={records[0]?.date.split(' ').slice(0, 2).join(' ') || '—'} foot={records[0]?.title || 'No records yet'} tone="lavender" />
      <StatCard icon={<Share2 size={18} />} title="Active access grants" value={shares.filter((share) => share.active && !share.isDemo).length.toString()} foot="Demo samples don’t grant provider access" tone="peach" />
    </div>
    <div className="overview-grid">
      <section className="panel timeline-panel"><div className="panel-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>Your medical timeline</h2></div><button className="text-button" onClick={() => onPage('Medical timeline')}>View timeline <ArrowRight size={15} /></button></div><div className="mini-timeline">{recent.map((record, index) => <button key={record.id} className="mini-record" onClick={() => onOpenRecord(record)}><div className="mini-date">{record.date.split(' ').slice(0, 2).join(' ')}</div><div className={`timeline-node ${index === 0 ? 'current' : ''}`}><span /></div><RecordIcon record={record} /><div className="record-copy"><strong>{record.title}</strong><span>{record.source} <span className="record-separator">·</span> {record.type}</span></div><ArrowUpRight className="record-open" size={16} /></button>)}</div></section>
      <section className="panel access-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR CHOICE, ALWAYS</div><h2>Shared access</h2></div><button className="round-link" onClick={() => onPage('Sharing & access')} aria-label="View sharing"><ArrowRight size={16} /></button></div><p className="panel-description">Only the care teams you choose can view your records.</p><div className="share-summary">{shares.filter((share) => share.active).slice(0, 2).map((share) => <div className="share-summary-row" key={share.id}><span className={`org-avatar ${share.tint}`}>{share.initials}</span><span className="summary-name"><strong>{share.hospital}</strong><small>{share.isDemo ? 'Demo sample · no provider access' : `Access until ${share.expires}`}</small></span>{share.isDemo ? <Sparkles size={14} /> : <span className="active-dot" />}</div>)}</div><button className="manage-access" onClick={() => onPage('Sharing & access')}>Manage permissions <ArrowRight size={15} /></button></section>
    </div>
    <div className="reassurance"><ShieldCheck size={17} /><span><strong>Your records, your decision.</strong> You can check who has access and revoke permission whenever you choose.</span><button onClick={() => onPage('Sharing & access')}>Review access</button></div>
  </>
}

function StatCard({ icon, title, value, foot, tone }) {
  return <div className="stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><div className="stat-label">{title}</div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>
}

function Timeline({ records, total, live, pageNumber, setPageNumber, query, setQuery, category, setCategory, dateFrom, setDateFrom, dateTo, setDateTo, showFilters, setShowFilters, onOpen, onUpload, onDownload }) {
  return <>
    <div className="section-header"><div><div className="eyebrow">YOUR HEALTH, IN ORDER</div><h1>Medical timeline</h1><p className="page-subtitle">Every record, from every provider, in one place.</p></div><button className="button primary" onClick={onUpload}><Plus size={17} />Add a record</button></div>
    <div className="timeline-toolbar"><label className="search-box"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search records, providers, dates…" /><kbd>⌘ K</kbd></label><button className={`button filter-button ${showFilters ? 'pressed' : ''}`} onClick={() => setShowFilters((open) => !open)}><SlidersHorizontal size={16} />Filters</button><span className="result-count">{total} records</span></div>
    {showFilters && <div className="filter-panel"><div className="filter-row">{categoryFilters.map((filter) => <button key={filter} onClick={() => setCategory(filter)} className={`filter-chip ${category === filter ? 'chosen' : ''}`}>{filter}{category === filter && <Check size={13} />}</button>)}</div><div className="date-filter"><label>From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label><label>To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>{(dateFrom || dateTo) && <button className="text-button" onClick={() => { setDateFrom(''); setDateTo('') }}>Clear dates</button>}</div></div>}
    <section className="panel records-panel"><div className="table-heading"><span>RECORD</span><span>DATE</span><span>PROVIDER</span><span>SOURCE</span><span /></div>{records.length ? records.map((record) => <div className="record-row" key={record.id}><button className="record-title-cell" onClick={() => onOpen(record)}><RecordIcon record={record} /><span><strong>{record.title}</strong><small>{record.type} <i>·</i> {record.id}</small></span></button><span className="date-cell">{record.date}</span><span className="provider-cell">{record.source}</span><span><span className={`source-badge compact ${record.sourceType}`}>{record.sourceType === 'verified' ? <><BadgeCheck size={12} />Verified</> : <><UserRound size={12} />Uploaded</>}</span></span><button className="row-menu" onClick={() => onDownload(record)} aria-label={`Download ${record.title}`}><Download size={16} /></button></div>) : <div className="empty-state"><Search size={24} /><strong>No matching records</strong><span>Try another keyword or clear your category filter.</span></div>}</section>
    {live && total > 25 && <div className="pagination"><span>Showing {(pageNumber - 1) * 25 + 1}–{Math.min(pageNumber * 25, total)} of {total}</span><div><button className="button secondary" disabled={pageNumber <= 1} onClick={() => setPageNumber((page) => page - 1)}><ChevronLeft size={15} />Previous</button><button className="button secondary" disabled={pageNumber * 25 >= total} onClick={() => setPageNumber((page) => page + 1)}>Next<ChevronRight size={15} /></button></div></div>}
    <div className="privacy-footnote"><LockKeyhole size={14} />Only you and the care teams you authorize can access your health records.</div>
  </>
}

function Sharing({ shares, onNew, onRevoke }) {
  const activeProviderGrants = shares.filter((share) => share.active && !share.isDemo).length
  return <>
    <div className="section-header"><div><div className="eyebrow">CONSENT AT A GLANCE</div><h1>Sharing & access</h1><p className="page-subtitle">You decide who can view your health records.</p></div><button className="button primary" onClick={onNew}><Plus size={17} />Share records</button></div>
    <div className="sharing-banner"><div className="share-shield"><ShieldCheck size={24} /></div><div><strong>Access stays in your hands</strong><p>Every grant has a clear scope and expiry date. Revoking access takes effect immediately.</p></div><div className="share-stat"><strong>{activeProviderGrants}</strong><span>active provider grants</span></div></div>
    <div className="access-list-heading"><div><h2>Care teams</h2><p>Providers you’ve chosen to share records with.</p></div><div className="access-legend"><span className="active-dot" /> Active <span className="revoked-dot" /> Revoked</div></div>
    <div className="grant-list">{shares.map((share) => <article className={`grant-card ${share.active ? '' : 'revoked'}`} key={share.id}><span className={`org-avatar large ${share.tint}`}>{share.initials}</span><div className="grant-main"><div className="grant-title"><h3>{share.hospital}</h3><span className={`grant-status ${share.active ? 'on' : 'off'}`}><i />{share.isDemo ? 'Demo sample' : share.active ? 'Active' : 'Revoked'}</span></div><p>{share.isDemo ? 'Synthetic demo entry · no provider can access these records' : <>{share.doctor} <span>·</span> Verified provider</>}</p><div className="grant-meta"><span><Eye size={14} />{share.access}</span><span><Clock3 size={14} />{share.active ? `Expires ${share.expires}` : `Ended ${share.expires}`}</span></div></div>{share.active && <button className="button revoke-button" onClick={() => onRevoke(share.id)}><X size={15} />Revoke access</button>}</article>)}</div>
    <div className="reassurance share-reassurance"><LockKeyhole size={17} /><span><strong>All access is recorded.</strong> You can review access history in your account audit trail.</span><button>View access history</button></div>
  </>
}

function SettingsPage({ announce, session, onProfileUpdate, onPasswordRecovery }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(session?.name || 'Ananya Rao')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => setName(session?.name || 'Ananya Rao'), [session?.name])
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  async function saveProfile(event) {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onProfileUpdate(name); setEditing(false) }
    catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }
  return <><div className="section-header"><div><div className="eyebrow">YOUR ACCOUNT</div><h1>Profile & settings</h1><p className="page-subtitle">Manage your personal details and security preferences.</p></div></div><section className="panel settings-panel"><div className="settings-identity"><span className="avatar settings-avatar">{initials}</span><div><strong>{session?.name || 'Ananya Rao'}</strong><span>{session ? session.email : 'Patient account · Joined January 2026'}</span></div><button className="button secondary" onClick={() => setEditing((open) => !open)}>Edit profile</button></div>{editing && <form className="profile-edit" onSubmit={saveProfile}><label>Full name<input required minLength="2" maxLength="120" value={name} onChange={(e) => setName(e.target.value)} disabled={!session} /></label>{error && <p className="field-error">{error}</p>}<button className="button primary" disabled={!session || saving} type="submit">{saving ? 'Saving…' : 'Save changes'}</button>{!session && <small>Sign in to edit a connected account.</small>}</form>}<div className="settings-row"><div><strong>Account security</strong><span>Login, password and recovery preferences</span></div><button onClick={session ? onPasswordRecovery : () => announce('Sign in to manage account recovery')}>Reset password <ArrowRight size={15} /></button></div><div className="settings-row"><div><strong>Access history</strong><span>Review when your records were viewed or shared</span></div><button onClick={() => announce(session ? 'Your access events are recorded in the audit history.' : 'Your demo access history is available in the audit view')}>View history <ArrowRight size={15} /></button></div><div className="settings-row"><div><strong>Download your data</strong><span>Request a copy of your MediVault information</span></div><button onClick={() => announce('Data export is available through the secure API')}>Request export <ArrowRight size={15} /></button></div></section><div className="privacy-footnote"><LockKeyhole size={14} />{session ? 'Account data is managed by the connected MediVault API.' : 'This demo does not store real patient information.'}</div></>
}

function ProviderPage({ page, records, announce, live, onRefresh, organization }) {
  const [patientSearch, setPatientSearch] = useState('')
  const [patientMatch, setPatientMatch] = useState(null)
  const [patientRecords, setPatientRecords] = useState([])
  const [issueName, setIssueName] = useState('')
  const [issueType, setIssueType] = useState('Lab report')
  const [issueFile, setIssueFile] = useState(null)
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  const [issueError, setIssueError] = useState('')
  const [auditEvents, setAuditEvents] = useState([])

  useEffect(() => {
    let active = true
    if (live && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientSearch)) {
      apiRequest(`/hospital/patients/lookup?email=${encodeURIComponent(patientSearch)}`).then(({ patient }) => { if (active) setPatientMatch(patient) }).catch(() => { if (active) setPatientMatch(null) })
    } else if (!patientSearch) setPatientMatch(null)
    return () => { active = false }
  }, [patientSearch, live])

  useEffect(() => {
    if (live && page === 'Access log') apiRequest('/audit?limit=50').then(({ events }) => setAuditEvents(events)).catch((error) => announce(error.message))
  }, [live, page])

  async function issueDocument(event) {
    event.preventDefault()
    if (!live) { announce('Synthetic document issued to Ananya Rao'); setIssueName(''); setPatientSearch(''); return }
    if (!issueFile) { setIssueError('Choose the document file to issue.'); return }
    setBusy(true)
    setIssueError('')
    try {
      const form = new FormData()
      form.append('file', issueFile)
      form.append('patientEmail', patientSearch)
      form.append('title', issueName)
      form.append('category', mapCategoryToApi(issueType))
      form.append('visitDate', new Date(`${issueDate}T12:00:00.000Z`).toISOString())
      const { record } = await apiRequest('/hospital/records', { method: 'POST', body: form })
      announce(`Document issued to patient · ${record.id}`)
      setIssueName('')
      setIssueFile(null)
      setPatientSearch('')
      await onRefresh()
    } catch (error) { setIssueError(error.message) }
    finally { setBusy(false) }
  }

  async function showPermittedRecords() {
    if (!live) { announce('Access is limited to records covered by consent'); return }
    if (!patientMatch) { announce('The patient must have an active consent for your organization'); return }
    try {
      const result = await apiRequest(`/hospital/patients/${patientMatch.id}/records`)
      setPatientRecords(result.records.map(fromApiRecord))
    } catch (error) { announce(error.message) }
  }

  if (live && !organization) return <><div className="section-header"><div><div className="eyebrow">PROVIDER WORKSPACE</div><h1>Membership needs review</h1><p className="page-subtitle">This account does not currently have an active membership in a verified organization.</p></div></div><div className="panel membership-notice"><Shield size={22} /><div><strong>Provider access is unavailable</strong><p>Contact a MediVault administrator to verify the organization and activate your staff membership. Patient records remain protected while access is inactive.</p></div></div></>

  if (page === 'Issue a document') return <>
    <div className="section-header"><div><div className="eyebrow">HOSPITAL WORKSPACE</div><h1>Issue a document</h1><p className="page-subtitle">Attach a provider-issued document to the correct patient account.</p></div><span className="verified-pill"><BadgeCheck size={15} />Verified organization</span></div>
    <form className="panel issue-panel" onSubmit={issueDocument}>
      <div className="demo-callout"><Sparkles size={17} /><span>{live ? 'Use the patient’s registered email. Uploaded documents are stored privately and marked as provider-issued.' : 'This provider workspace uses synthetic patient profiles. Never enter real patient information in the demo.'}</span></div>
      <label>Patient email<input type="email" required placeholder={live ? 'patient@example.com' : 'ananya.rao@example.test'} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} /></label>
      {patientSearch && <div className="patient-match"><span className="avatar small-avatar">{patientMatch ? patientMatch.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() : '…'}</span><div><strong>{patientMatch?.name || (live ? 'Confirm the registered email' : 'Ananya Rao')}</strong><small>{live ? patientMatch?.email || 'Patient account will be checked when issued' : 'ananya.rao@example.test · Demo patient'}</small></div><BadgeCheck size={16} /></div>}
      <div className="form-grid"><label>Document title<input required value={issueName} onChange={(e) => setIssueName(e.target.value)} placeholder="e.g. Blood test results" /></label><label>Record type<select value={issueType} onChange={(e) => setIssueType(e.target.value)}><option>Lab report</option><option>Prescription</option><option>Scan</option><option>Diagnosis</option><option>Discharge summary</option></select></label></div>
      {live && <div className="form-grid"><label>Visit date<input type="date" required value={issueDate} onChange={(e) => setIssueDate(e.target.value)} /></label><label>Document file<input type="file" required accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setIssueFile(e.target.files?.[0] || null)} /></label></div>}
      {issueError && <p className="field-error">{issueError}</p>}
      <button className="button primary" disabled={!issueName || !patientSearch || busy} type="submit"><FilePlus2 size={16} />{busy ? 'Issuing…' : live ? 'Issue document' : 'Issue demo document'}</button>
    </form>
  </>

  if (page === 'Patient records') return <>
    <div className="section-header"><div><div className="eyebrow">HOSPITAL WORKSPACE</div><h1>Patient records</h1><p className="page-subtitle">Records covered by active patient consent.</p></div><span className="verified-pill"><BadgeCheck size={15} />Verified organization</span></div>
    <label className="search-box patient-search"><Search size={17} /><input placeholder={live ? 'Find a patient by registered email' : 'Find a demo patient by name or email'} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} /></label>
    {patientSearch && <section className="panel provider-patient-card"><span className="avatar">{patientMatch?.name?.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'AR'}</span><div><strong>{patientMatch?.name || 'Ananya Rao'} {!live && <span className="demo-tag">DEMO</span>}</strong><p>{patientMatch?.email || (live ? 'A current consent is required to view this account.' : 'ananya.rao@example.test · Consent active')}</p></div><button className="button secondary" onClick={showPermittedRecords}>View permitted records <ArrowRight size={15} /></button></section>}
    {patientRecords.length > 0 && <section className="panel provider-record-results">{patientRecords.map((record) => <div className="provider-doc-row" key={record.id}><RecordIcon record={record} /><div><strong>{record.title}</strong><span>{record.source} · {record.date}</span></div><span className="source-badge verified"><BadgeCheck size={12} />Authorized</span></div>)}</section>}
    <div className="privacy-footnote"><LockKeyhole size={14} />Provider access is limited to active consent scopes and the organization’s verified membership.</div>
  </>

  if (page === 'Access log') return <><div className="section-header"><div><div className="eyebrow">AUDIT TRAIL</div><h1>Access log</h1><p className="page-subtitle">Sensitive activity in this hospital workspace.</p></div></div><section className="panel records-panel"><div className="table-heading log-grid"><span>ACTIVITY</span><span>RESOURCE</span><span>WHEN</span><span>RESULT</span></div>{(live ? auditEvents : [['Viewed shared lab report','Ananya Rao','Today, 10:42 am','Allowed']]).map((row, i) => live ? <div className="record-row log-grid" key={row.id}><span className="audit-activity"><ShieldCheck size={16} />{row.action}</span><span>{row.resourceType}</span><span className="date-cell">{new Date(row.occurredAt).toLocaleString()}</span><span className="audit-allowed"><CheckCircle2 size={14} />{row.outcome}</span></div> : <div className="record-row log-grid" key={i}><span className="audit-activity"><ShieldCheck size={16} />{row[0]}</span><span>{row[1]} <span className="demo-tag">DEMO</span></span><span className="date-cell">{row[2]}</span><span className="audit-allowed"><CheckCircle2 size={14} />{row[3]}</span></div>)}</section></>

  return <><div className="section-header"><div><div className="eyebrow">{organization?.name || 'SAHYADRI HOSPITAL'}</div><h1>Good morning, care team.</h1><p className="page-subtitle">A focused view of your team’s MediVault activity.</p></div><button className="button primary" onClick={() => announce('Choose “Issue a document” in the sidebar to get started')}><FilePlus2 size={16} />Issue document</button></div><div className="welcome-ribbon provider-ribbon"><div className="ribbon-symbol"><Hospital size={22} /></div><div><strong>Welcome to your verified workspace</strong><p>Issue documents to patients and review records shared with your care team.</p></div><span className="verified-pill"><BadgeCheck size={15} />Organization verified</span></div><div className="stats-grid"><StatCard icon={<Users size={18} />} title="Patient records available" value={live ? records.length.toString() : '12'} foot={live ? 'Within active consent scopes' : 'Demo patient profiles'} tone="green" /><StatCard icon={<FileText size={18} />} title="Documents issued" value={live ? records.filter((record) => record.sourceType === 'verified').length.toString() : '34'} foot={live ? 'Permitted records' : 'Across 12 demo patients'} tone="lavender" /><StatCard icon={<Share2 size={18} />} title="Organization status" value="Verified" foot="Patient-authorized access" tone="peach" /></div><section className="panel timeline-panel provider-recent"><div className="panel-heading"><div><div className="eyebrow">RECENT DOCUMENTS</div><h2>Recently available</h2></div><button className="text-button" onClick={() => announce('Records appear here only when a patient has granted access')}>Access policy <ArrowRight size={15} /></button></div>{records.slice(0, 3).map((record) => <div className="provider-doc-row" key={record.id}><RecordIcon record={record} /><div><strong>{record.title}</strong><span>{record.source} · {record.date}</span></div><span className="demo-tag">{live ? 'PERMITTED' : 'SYNTHETIC'}</span></div>)}</section></>
}

function AdminPage({ page, announce, live }) {
  const [organizations, setOrganizations] = useState([])
  const [summary, setSummary] = useState({ verified: 0, pending: 0, suspended: 0 })
  const [staff, setStaff] = useState([])
  const [events, setEvents] = useState([])
  const [corrections, setCorrections] = useState([])
  const [busyId, setBusyId] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteName, setInviteName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteOrganization, setInviteOrganization] = useState('')
  const [inviteRole, setInviteRole] = useState('clinician')
  const [inviteError, setInviteError] = useState('')

  useEffect(() => {
    if (!live) return
    let active = true
    const load = async () => {
      try {
        if (page === 'Organizations') {
          const [organizationResult, summaryResult] = await Promise.all([apiRequest('/admin/organizations'), apiRequest('/admin/summary')])
          if (active) { setOrganizations(organizationResult.organizations); setSummary(summaryResult.organizations || {}) }
        } else if (page === 'Staff accounts') {
          const [result, organizationResult] = await Promise.all([apiRequest('/admin/staff'), apiRequest('/admin/organizations?status=verified')])
          if (active) { setStaff(result.staff); setOrganizations(organizationResult.organizations) }
        } else if (page === 'Platform audit') {
          const result = await apiRequest('/admin/audit?limit=100')
          if (active) setEvents(result.events)
        } else if (page === 'Correction requests') {
          const result = await apiRequest('/admin/corrections')
          if (active) setCorrections(result.requests)
        }
      } catch (error) { announce(error.message) }
    }
    load()
    return () => { active = false }
  }, [live, page])

  async function changeOrgStatus(org) {
    const nextStatus = org.status === 'verified' ? 'suspended' : 'verified'
    if (!live) { announce(`${org.name} — ${nextStatus}`); return }
    setBusyId(org.id)
    try {
      const result = await apiRequest(`/admin/organizations/${org.id}/status`, { method: 'PATCH', body: { status: nextStatus } })
      setOrganizations((current) => current.map((item) => item.id === org.id ? { ...item, status: result.organization.status, reviewedAt: result.organization.reviewedAt } : item))
      announce(`${org.name} marked ${nextStatus}`)
    } catch (error) { announce(error.message) }
    finally { setBusyId('') }
  }

  async function reviewCorrection(item, status) {
    if (!live) { announce(`Correction request marked ${status}`); return }
    try {
      await apiRequest(`/admin/corrections/${item.id}`, { method: 'PATCH', body: { status } })
      setCorrections((current) => current.filter((request) => request.id !== item.id))
      announce(`Correction request marked ${status}`)
    } catch (error) { announce(error.message) }
  }

  async function inviteStaff(event) {
    event.preventDefault()
    if (!live) { announce('Staff accounts are created through the connected admin service'); return }
    setInviteError('')
    try {
      await apiRequest(`/admin/organizations/${inviteOrganization}/staff`, { method: 'POST', body: { name: inviteName, email: inviteEmail, password: invitePassword, role: inviteRole } })
      const result = await apiRequest('/admin/staff')
      setStaff(result.staff)
      setInviteName(''); setInviteEmail(''); setInvitePassword(''); setInviteOpen(false)
      announce('Staff account added to the verified organization')
    } catch (error) { setInviteError(error.message) }
  }

  async function toggleStaffStatus(user) {
    if (!live) { announce(`${user[0]} account status changed`); return }
    try {
      const result = await apiRequest(`/admin/staff/${user.id}/status`, { method: 'PATCH', body: { active: !user.active } })
      setStaff((current) => current.map((item) => item.id === user.id ? { ...item, active: result.user.active } : item))
      announce(`${user.name} account ${result.user.active ? 'reactivated' : 'suspended'}`)
    } catch (error) { announce(error.message) }
  }

  if (page === 'Staff accounts') return <><div className="section-header"><div><div className="eyebrow">ADMIN CONSOLE</div><h1>Staff accounts</h1><p className="page-subtitle">Organization-level access management.</p></div>{live ? <button className="button primary" onClick={() => setInviteOpen((open) => !open)}><Plus size={16} />{inviteOpen ? 'Close form' : 'Add staff'}</button> : <span className="verified-pill"><ShieldCheck size={15} />Role-based access</span>}</div>{inviteOpen && live && <form className="panel invite-panel" onSubmit={inviteStaff}><label>Full name<input required minLength="2" value={inviteName} onChange={(e) => setInviteName(e.target.value)} /></label><label>Email<input type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label><label>Verified organization<select required value={inviteOrganization} onChange={(e) => setInviteOrganization(e.target.value)}><option value="">Choose organization</option>{organizations.map((org) => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><label>Workspace role<select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}><option value="clinician">Clinician</option><option value="records_staff">Records staff</option><option value="organization_admin">Organization admin</option></select></label><label>Initial password<input type="password" required minLength="12" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} /></label>{inviteError && <p className="field-error invite-error">{inviteError}</p>}<div className="invite-actions"><span>Use a unique password and share it with the staff member securely.</span><button className="button primary" type="submit">Create staff account</button></div></form>}<section className="panel records-panel"><div className="table-heading staff-grid"><span>STAFF MEMBER</span><span>ORGANIZATION</span><span>ROLE</span><span>STATUS</span><span /></div>{(live ? staff : [['Dr. Meera Joshi','Sahyadri Hospital','Clinician','Active'],['Sonal Deshmukh','Sahyadri Hospital','Records staff','Active'],['Admin User','MediVault','Platform admin','Active']]).map((row) => <div className="record-row staff-grid" key={live ? row.id : row[0]}><strong>{live ? row.name : row[0]}</strong><span>{live ? row.organization : row[1]}</span><span>{live ? row.membershipRole : row[2]}</span><span className="audit-allowed"><CheckCircle2 size={14} />{live ? row.active ? 'Active' : 'Suspended' : row[3]}</span><button className="row-menu" title={live ? row.active ? 'Suspend account' : 'Reactivate account' : 'Manage account'} onClick={() => toggleStaffStatus(live ? row : row)}><MoreHorizontal size={17} /></button></div>)}</section>{live && staff.length === 0 && <div className="privacy-footnote">No staff accounts have been created yet.</div>}</>
  if (page === 'Platform audit') return <><div className="section-header"><div><div className="eyebrow">SECURITY OVERSIGHT</div><h1>Platform audit</h1><p className="page-subtitle">Sensitive actions across the MediVault environment.</p></div></div><section className="panel records-panel"><div className="table-heading log-grid"><span>ACTION</span><span>ACTOR</span><span>WHEN</span><span>STATUS</span></div>{(live ? events : [['Organization verified','MediVault admin','Today, 9:20 am','Completed'],['Consent revoked','Ananya Rao','Yesterday, 6:13 pm','Completed'],['Document downloaded','Dr. Meera Joshi','Yesterday, 4:18 pm','Authorized']]).map((row, index) => live ? <div className="record-row log-grid" key={row.id}><span className="audit-activity"><ShieldCheck size={16} />{row.action}</span><span>{row.actorRole}</span><span className="date-cell">{new Date(row.occurredAt).toLocaleString()}</span><span className="audit-allowed"><CheckCircle2 size={14} />{row.outcome}</span></div> : <div className="record-row log-grid" key={index}><span className="audit-activity"><ShieldCheck size={16} />{row[0]}</span><span>{row[1]}</span><span className="date-cell">{row[2]}</span><span className="audit-allowed"><CheckCircle2 size={14} />{row[3]}</span></div>)}</section></>
  if (page === 'Correction requests') return <><div className="section-header"><div><div className="eyebrow">RECORD DISPUTES</div><h1>Correction requests</h1><p className="page-subtitle">Review patient requests about records linked to their accounts.</p></div></div><div className="correction-list">{corrections.map((item) => <article className="panel correction-card" key={item.id}><div className="correction-heading"><div><strong>{item.patient.name}</strong><span>{item.patient.email}</span></div><span className="demo-tag">{item.status.toUpperCase()}</span></div><p className="correction-record">{item.record?.title || 'Record'} · {item.record?.category || 'Record unavailable'}</p><p className="correction-reason">{item.reason}</p><div className="correction-actions"><button className="button secondary" onClick={() => reviewCorrection(item, 'dismissed')}>Dismiss</button><button className="button primary" onClick={() => reviewCorrection(item, 'resolved')}>Mark resolved</button></div></article>)}{corrections.length === 0 && <div className="panel empty-state"><CheckCircle2 size={24} /><strong>No open correction requests</strong><span>New patient requests will appear here.</span></div>}</div></>
  return <><div className="section-header"><div><div className="eyebrow">ADMIN CONSOLE</div><h1>Organization verification</h1><p className="page-subtitle">Review healthcare organizations requesting access to MediVault.</p></div><button className="button secondary" onClick={async () => { const name = window.prompt('Organization name'); if (!name) return; if (live) { const type = window.prompt('Organization type: hospital, clinic, laboratory or diagnostic_centre', 'hospital') || 'hospital'; try { await apiRequest('/admin/organizations', { method: 'POST', body: { name, type } }); const result = await apiRequest('/admin/organizations'); setOrganizations(result.organizations); announce('Organization submitted for verification') } catch (error) { announce(error.message) } } else announce(`${name} added to the review queue`) }}><Plus size={16} />Add organization</button></div><div className="admin-summary"><div><strong>{live ? summary.verified || 0 : 4}</strong><span>Verified</span></div><div><strong>{live ? summary.pending || 0 : 2}</strong><span>Under review</span></div><div><strong>{live ? summary.suspended || 0 : 0}</strong><span>Suspended</span></div></div><section className="panel records-panel"><div className="table-heading org-grid"><span>ORGANIZATION</span><span>TYPE</span><span>STATUS</span><span>REVIEWED</span><span /></div>{(live ? organizations : [{ id: '1', name: 'Sahyadri Hospital', type: 'hospital', status: 'verified', reviewedAt: '15 Oct 2026' }, { id: '2', name: 'Dr. Lal PathLabs', type: 'laboratory', status: 'verified', reviewedAt: '12 Oct 2026' }, { id: '3', name: 'Ruby Hall Clinic', type: 'hospital', status: 'verified', reviewedAt: '08 Oct 2026' }, { id: '4', name: 'Northside Medical Centre', type: 'clinic', status: 'pending' }, { id: '5', name: 'City Diagnostics', type: 'diagnostic_centre', status: 'pending' }]).map((org, index) => { const status = org.status === 'pending' ? 'Under review' : org.status[0].toUpperCase() + org.status.slice(1); const type = org.type === 'diagnostic_centre' ? 'Diagnostic centre' : org.type[0].toUpperCase() + org.type.slice(1); const colors = ['sage', 'blue', 'rose', 'lavender', 'peach']; return <div className="record-row org-grid" key={org.id}><span className="org-cell"><span className={`org-avatar ${colors[index % colors.length]}`}>{org.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><strong>{org.name}</strong></span><span>{type}</span><span className={org.status === 'verified' ? 'audit-allowed' : 'review-status'}>{org.status === 'verified' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{status}</span><span className="date-cell">{org.reviewedAt ? new Date(org.reviewedAt).toLocaleDateString('en-GB') : '—'}</span><button className="row-menu" disabled={busyId === org.id} onClick={() => changeOrgStatus(org)} aria-label={`Change ${org.name} verification status`} title={org.status === 'verified' ? 'Suspend organization' : 'Verify organization'}><MoreHorizontal size={17} /></button></div> })}</section></>
}
