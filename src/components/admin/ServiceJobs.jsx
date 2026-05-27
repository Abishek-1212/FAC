import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import AddressInput from '../common/AddressInput'
import InvoiceModal from '../common/InvoiceModal'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { formatAddressForDisplay } from '../../utils/addressFormatter'

const STATUS_META_LIGHT = {
  pending:     { color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400',  label: 'Pending', icon: '⏳' },
  assigned:    { color: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-400',   label: 'Assigned', icon: '📋' },
  in_progress: { color: 'bg-violet-100 text-violet-700 border-violet-200',dot: 'bg-violet-400', label: 'In Progress', icon: '🔄' },
  completed:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Completed', icon: '✅' },
  verified:    { color: 'bg-green-100 text-green-700 border-green-200',    dot: 'bg-green-400',  label: 'Verified', icon: '✔️' },
}

const STATUS_META_DARK = {
  pending:     { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   dot: 'bg-amber-400',  label: 'Pending', icon: '⏳' },
  assigned:    { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',      dot: 'bg-blue-400',   label: 'Assigned', icon: '📋' },
  in_progress: { color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',dot: 'bg-violet-400', label: 'In Progress', icon: '🔄' },
  completed:   { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Completed', icon: '✅' },
  verified:    { color: 'bg-green-500/20 text-green-300 border-green-500/30',    dot: 'bg-green-400',  label: 'Verified', icon: '✔️' },
}

const SERVICE_TYPES = ['New Fitting', 'Service / Repair']

const inputCls = (isDark) => `w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
  isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.07)]'
}`

const EMPTY_FORM = {
  customerName: '', customerPhone: '', 
  customerAddress: {
    houseNo: '', building: '', street: '', city: '', state: 'Tamil Nadu', pinCode: '', landmark: ''
  },
  problemDescription: '', serviceType: 'Service / Repair',
  technicianId: '', priority: 'normal', assignmentMode: 'broadcast',
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ServiceJobs() {
  const { isDark } = useTheme()
  const [jobs, setJobs] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [modal, setModal] = useState(false)
  const [detailJob, setDetailJob] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState(null)

  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), snap =>
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    const u2 = onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap =>
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => t.isActive))
    )
    return () => { u1(); u2() }
  }, [])

  const handlePreview = (e) => {
    e.preventDefault()
    if (form.customerPhone.length !== 10) {
      toast.error('❌ Please enter a valid 10-digit phone number')
      return
    }
    setShowConfirm(true)
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      const techName = technicians.find(t => t.id === form.technicianId)?.name || ''
      const jobData = {
        ...form,
        technicianName: techName,
        status: form.assignmentMode === 'direct' && form.technicianId ? 'assigned' : 'pending',
        assignmentMode: form.assignmentMode,
        createdAt: serverTimestamp(),
      }
      
      const jobRef = await addDoc(collection(db, 'service_jobs'), jobData)
      
      // If broadcast mode, create notifications for all technicians
      if (form.assignmentMode === 'broadcast') {
        const notificationData = {
          jobId: jobRef.id,
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerAddress: form.customerAddress,
          serviceType: form.serviceType,
          priority: form.priority,
          createdAt: serverTimestamp(),
          read: false,
          type: 'job_available'
        }
        
        // Send to all technicians
        for (const tech of technicians) {
          await addDoc(collection(db, 'users', tech.id, 'notifications'), notificationData)
        }
      }
      
      toast.success(form.assignmentMode === 'broadcast' ? '✅ Job posted! Technicians notified.' : '✅ Job assigned!')
      setModal(false)
      setShowConfirm(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }



  const filterJobsByToday = (jobsList) => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    return jobsList.filter(j => {
      const jobDate = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt?.seconds * 1000 || 0)
      return jobDate >= today && jobDate < tomorrow
    })
  }

  const active = jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status) && !j.movedToFollowUp)
  const completed = jobs.filter(j => ['completed', 'verified'].includes(j.status) && !j.movedToFollowUp)
  const total = jobs.filter(j => !j.movedToFollowUp)

  const todayActive = filterJobsByToday(active)
  const todayCompleted = filterJobsByToday(completed)
  const todayTotal = filterJobsByToday(total)

  const filtered = statusFilter === 'active' ? todayActive : statusFilter === 'completed' ? todayCompleted : todayTotal

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div className={`flex items-center justify-center px-4 py-4 border rounded-full mx-4 relative ${
        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={() => window.history.back()}
          className={`absolute left-4 p-2 rounded-lg transition-all ${
            isDark
              ? 'hover:bg-white/10 text-white/70 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          SERVICE JOBS
        </h1>
      </div>

      <div className="space-y-5 mt-5">
      {/* New Job Button - Centered below header */}
      <div className="flex justify-center mb-5">
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setModal(true)}
          className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-shadow ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + New Job
        </motion.button>
      </div>

      {/* Status Filter Pills */}
      <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">
        {['active', 'completed', 'total'].map((key) => {
          const statusConfig = {
            active: { 
              label: 'Active Jobs', 
              count: todayActive.length,
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ),
              gradient: 'from-blue-500 to-blue-600',
              bgLight: 'bg-blue-50',
              textLight: 'text-blue-700',
              borderLight: 'border-blue-200'
            },
            completed: { 
              label: 'Completed', 
              count: todayCompleted.length,
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
              gradient: 'from-emerald-500 to-emerald-600',
              bgLight: 'bg-emerald-50',
              textLight: 'text-emerald-700',
              borderLight: 'border-emerald-200'
            },
            total: { 
              label: 'Total Jobs', 
              count: todayTotal.length,
              icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              ),
              gradient: 'from-gray-500 to-gray-600',
              bgLight: 'bg-gray-50',
              textLight: 'text-gray-700',
              borderLight: 'border-gray-200'
            },
          }
          const config = statusConfig[key]
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all shadow-sm ${
                statusFilter === key
                  ? isDark
                    ? `bg-gradient-to-r ${config.gradient} text-white shadow-lg`
                    : `bg-gradient-to-r ${config.gradient} text-white shadow-md`
                  : isDark
                  ? 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10'
                  : `${config.bgLight} ${config.textLight} border ${config.borderLight} hover:shadow-md`
              }`}
            >
              <div className={statusFilter === key ? '' : 'opacity-60'}>
                {config.icon}
              </div>
              <span>{config.label}</span>
              <span className={`min-w-[28px] h-6 flex items-center justify-center px-2 rounded-lg text-xs font-black ${
                statusFilter === key
                  ? 'bg-white/25 text-white'
                  : isDark ? 'bg-white/10 text-white/50' : 'bg-white/60 text-gray-700'
              }`}>
                {config.count}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Service Jobs List */}
      <div className={`rounded-2xl border overflow-hidden shadow-sm mt-4 ${
        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
      }`}>
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 ${
              isDark ? 'bg-dark-card' : 'bg-white'
            }`}>
              {filtered.map((job, i) => {
                const meta = STATUS_META[job.status] || STATUS_META.pending
                const isUrgent = job.priority === 'urgent'
                const time = job.createdAt?.toDate?.() || (job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date())

                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`rounded-2xl border p-4 transition-all hover:shadow-lg ${
                      isDark
                        ? 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/10'
                        : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between" onClick={() => setDetailJob(job)}>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {job.customerName}
                        </p>
                        <p className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                          {job.customerPhone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                          job.serviceType === 'New Fitting'
                            ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'
                            : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-600'
                        }`}>
                          {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                          job.technicianName
                            ? isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                            : isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {job.technicianName ? `👷 ${job.technicianName}` : '⚠️ Unassigned'}
                        </span>
                        {job.nextServiceDate && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                            isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-600'
                          }`}>
                            📅 Next: {formatDate(job.nextServiceDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`p-12 text-center ${
                isDark ? 'bg-dark-card' : 'bg-white'
              }`}
            >
              <p className="text-4xl mb-3">🔧</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>No service jobs found</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Create Job Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setShowConfirm(false) }} title={showConfirm ? 'Confirm Job Details' : 'Create Service Job'} size="lg">
        {showConfirm ? (
          <div className="space-y-4">
            {/* Preview Card */}
            <div className={`rounded-2xl border p-4 space-y-3 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${
                isDark ? 'text-white/40' : 'text-gray-400'
              }`}>Review before creating</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['👤 Customer', form.customerName],
                  ['📞 Phone', form.customerPhone],
                  ['🛠️ Service Type', form.serviceType],
                  ['⚡ Priority', form.priority === 'urgent' ? '🔴 Urgent' : '🟢 Normal'],
                  ['📢 Assignment', form.assignmentMode === 'broadcast' ? '📢 Broadcast' : `👤 ${technicians.find(t => t.id === form.technicianId)?.name || '—'}`],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-xl p-3 ${
                    isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'
                  }`}>
                    <p className={`text-xs font-semibold ${
                      isDark ? 'text-white/40' : 'text-gray-400'
                    }`}>{label}</p>
                    <p className={`font-bold text-sm mt-0.5 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>{value}</p>
                  </div>
                ))}
                <div className={`col-span-2 rounded-xl p-3 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'
                }`}>
                  <p className={`text-xs font-semibold ${
                    isDark ? 'text-white/40' : 'text-gray-400'
                  }`}>📍 Address</p>
                  <p className={`font-bold text-sm mt-0.5 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>{formatAddressForDisplay(form.customerAddress)}</p>
                </div>
                <div className={`col-span-2 rounded-xl p-3 ${
                  isDark ? 'bg-white/5 border border-white/10' : 'bg-white border border-gray-200'
                }`}>
                  <p className={`text-xs font-semibold ${
                    isDark ? 'text-white/40' : 'text-gray-400'
                  }`}>📝 Problem</p>
                  <p className={`font-bold text-sm mt-0.5 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>{form.problemDescription}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowConfirm(false)}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all ${
                  isDark
                    ? 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:text-white'
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Edit
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={saving}
                className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white shadow-lg disabled:opacity-60 disabled:cursor-not-allowed transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-500/25 hover:shadow-emerald-500/40'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-emerald-200 hover:shadow-emerald-300'
                }`}
              >
                {saving ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Creating Job...
                  </>
                ) : (
                  'Confirm & Create'
                )}
              </motion.button>
            </div>
          </div>
        ) : (
        <form onSubmit={handlePreview} className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Assignment Mode Section - FIRST */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>How to Assign?</p>
            <div className="flex gap-2 mb-3">
              {[
                { key: 'broadcast', label: 'Broadcast to All', icon: '📢'},
                { key: 'direct', label: 'Direct Assignment', icon: '👤' }
              ].map(mode => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, assignmentMode: mode.key }))}
                  className={`flex-1 py-3 px-3 rounded-xl text-sm font-semibold border-2 transition ${
                    form.assignmentMode === mode.key
                      ? isDark ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' : 'border-cyan-500 bg-cyan-50 text-cyan-700'
                      : isDark ? 'border-white/10 bg-white/5 text-white/60 hover:border-white/20' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg mb-1">{mode.icon}</div>
                  <div className="font-bold">{mode.label}</div>
                  <div className="text-xs opacity-70">{mode.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Customer Info Section */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Customer Information</p>
            <div className="space-y-3">
              {/* Customer Name */}
            <div>
              <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Full Name</label>
              <input
                type="text"
                value={form.customerName}
                onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
                required
                className={inputCls(isDark)}
              />
            </div>

            {/* Customer Phone with Validation */}
            <div>
              <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Phone Number *</label>
              <input
                type="tel"
                value={form.customerPhone}
                onChange={e => {
                  const value = e.target.value.replace(/\D/g, '')
                  if (value.length <= 10) {
                    setForm(f => ({ ...f, customerPhone: value }))
                  }
                }}
                placeholder="10-digit phone number"
                maxLength="10"
                required
                className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${
                  form.customerPhone.length === 10
                    ? isDark ? 'border-green-500 focus:ring-green-500' : 'border-green-500 focus:ring-green-500'
                    : form.customerPhone.length > 0
                    ? isDark ? 'border-amber-500 focus:ring-amber-500' : 'border-amber-500 focus:ring-amber-500'
                    : isDark ? 'border-white/10 focus:ring-cyan-500' : 'border-gray-200 focus:ring-cyan-500'
                } ${isDark ? 'bg-white/5 text-white' : 'bg-white text-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.07)]'}`}
              />
              <div className="mt-1.5 flex items-center gap-2">
                {form.customerPhone.length > 0 && form.customerPhone.length < 10 && (
                  <p className={`text-xs flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                    <span>⚠️</span>
                    <span>{10 - form.customerPhone.length} more digit{10 - form.customerPhone.length !== 1 ? 's' : ''} needed</span>
                  </p>
                )}
              </div>
            </div>

            {/* Customer Address */}
            <div>
              <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Address Details</p>
              <AddressInput
                value={form.customerAddress}
                onChange={addr => setForm(f => ({ ...f, customerAddress: addr }))}
              />
            </div>
            </div>
          </div>

          {/* Service Details Section */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Service Details</p>
            <div className="space-y-3">
              {/* Service Type */}
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Service Type</label>
                <div className="flex gap-2 mt-2">
                  {SERVICE_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, serviceType: t }))}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                        form.serviceType === t
                          ? isDark ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400' : 'border-cyan-500 bg-cyan-50 text-cyan-700'
                          : isDark ? 'border-white/10 bg-white/5 text-white/60 hover:border-white/20' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                      }`}
                    >
                      {t === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service / Repair'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Problem Description */}
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Problem Description</label>
                <textarea
                  value={form.problemDescription}
                  onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))}
                  required
                  rows={3}
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-[0_1px_4px_rgba(0,0,0,0.07)]'}`}
                />
              </div>
            </div>
          </div>



          {/* Assignment Section */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              {form.assignmentMode === 'direct' && (
                <div>
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Technician *</label>
                  <select
                    value={form.technicianId}
                    onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))}
                    required={form.assignmentMode === 'direct'}
                    className={inputCls(isDark)}
                  >
                    <option value="" className="text-gray-900">Select Technician</option>
                    {technicians.map(t => <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className={inputCls(isDark)}
                >
                  <option value="normal" className="text-gray-900">Normal</option>
                  <option value="urgent" className="text-gray-900">Urgent</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={() => setModal(false)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-glow-cyan-sm' : 'bg-gradient-to-r from-cyan-500 to-cyan-600'}`}
            >
              Review Job →
            </button>
          </div>
        </form>
        )}
      </Modal>

      {/* Job Detail Modal */}
      <Modal open={!!detailJob} onClose={() => setDetailJob(null)} title="Job Details" size="lg">
        {detailJob && (() => {
          const meta = STATUS_META[detailJob.status] || STATUS_META.pending
          return (
            <div className="space-y-4">
              {/* Status banner */}
              <div className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${meta.color}`}>
                <div className={`w-3 h-3 rounded-full ${meta.dot} animate-pulse`} />
                <div>
                  <p className="font-bold text-sm">{meta.label}</p>
                  <p className="text-xs opacity-70">Current job status</p>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['👤 Customer', detailJob.customerName],
                  ['📞 Phone', detailJob.customerPhone],
                  ['📅 Date', formatDate(detailJob.createdAt)],
                  ['👷 Technician', detailJob.technicianName || 'Unassigned'],
                  ['⚡ Priority', detailJob.priority === 'urgent' ? '🔴 Urgent' : '🟢 Normal'],
                  ['🛠️ Service Type', detailJob.serviceType || '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{label}</p>
                    <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                  </div>
                ))}
                <div className={`col-span-2 rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📍 Address</p>
                  <p className={`font-bold text-sm mt-0.5 whitespace-pre-line ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatAddressForDisplay(detailJob.customerAddress)}</p>
                </div>
                <div className={`col-span-2 rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📝 Problem</p>
                  <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailJob.problemDescription}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {selectedJobForInvoice && (
        <InvoiceModal
          open={invoiceModal}
          onClose={() => {
            setInvoiceModal(false)
            setSelectedJobForInvoice(null)
          }}
          job={selectedJobForInvoice}
          isDark={isDark}
        />
      )}
      </div>
    </div>
  )
}
