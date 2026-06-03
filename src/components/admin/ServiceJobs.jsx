import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where, deleteDoc, getDocs } from 'firebase/firestore'
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

const inputCls = (isDark) => `w-full mt-1 border-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 transition-shadow ${
  isDark
    ? 'bg-[#151b2b] text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)] focus:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04),0_0_0_2px_rgba(6,182,212,0.3)]'
    : 'bg-[#e8f4fb] text-gray-800 shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] focus:shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9),0_0_0_2px_rgba(6,182,212,0.3)]'
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
  const [deleteConfirm, setDeleteConfirm] = useState(null)

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

  useEffect(() => {
    const prefillData = sessionStorage.getItem('prefillFollowUpData')
    if (prefillData) {
      const data = JSON.parse(prefillData)
      setForm(prev => ({
        ...prev,
        customerName: data.customerName || '',
        customerPhone: data.customerPhone || '',
        customerAddress: data.customerAddress || { houseNo: '', building: '', street: '', city: '', state: 'Tamil Nadu', pinCode: '', landmark: '' },
        problemDescription: data.problemDescription || '',
        serviceType: data.serviceType || 'Service / Repair',
        isFollowUp: data.isFollowUp || false,
        originalJobId: data.originalJobId || null,
        movedToFollowUp: data.movedToFollowUp || false,
      }))
      setModal(true)
      sessionStorage.removeItem('prefillFollowUpData')
    }
  }, [])

  const handlePreview = (e) => {
    e.preventDefault()
    if (form.customerPhone.length !== 10) {
      toast.error('❌ Please enter a valid 10-digit phone number')
      return
    }
    setShowConfirm(true)
  }

  const handleDelete = async (job) => {
    const toastId = toast.loading('🗑️ Deleting job...')
    try {
      if (job.assignmentMode === 'broadcast') {
        for (const tech of technicians) {
          const notifSnap = await getDocs(
            query(collection(db, 'users', tech.id, 'notifications'), where('jobId', '==', job.id))
          )
          for (const n of notifSnap.docs) await deleteDoc(n.ref)
        }
      }
      await deleteDoc(doc(db, 'service_jobs', job.id))
      toast.success('🗑️ Job deleted successfully', { id: toastId })
      setDeleteConfirm(null)
    } catch (err) {
      toast.error(err.message, { id: toastId })
    }
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
        isFollowUp: form.isFollowUp || false,
        originalJobId: form.originalJobId || null,
        movedToFollowUp: form.movedToFollowUp || false,
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
      <div
        className="flex items-center justify-center px-4 py-4 rounded-full mx-4 relative"
        style={{
          background: isDark ? '#151B2B' : '#e8f4fb',
          boxShadow: isDark
            ? '6px 6px 14px #0a0f1a, -6px -6px 14px #202d42'
            : '6px 6px 14px #c5d8e8, -6px -6px 14px #ffffff'
        }}
      >
        <button
          onClick={() => window.history.back()}
          className="absolute left-4 p-2 rounded-xl transition-all"
          style={{
            background: isDark ? '#151B2B' : '#e8f4fb',
            boxShadow: isDark
              ? '3px 3px 7px #0a0f1a, -3px -3px 7px #202d42'
              : '3px 3px 7px #c5d8e8, -3px -3px 7px #ffffff',
            color: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563'
          }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
          SERVICE JOBS
        </h1>
      </div>

      <div className="space-y-5 mt-5">
      {/* New Job Button - Centered below header */}
      <div className="flex justify-center mb-5">
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={() => setModal(true)}
          className={`px-6 py-3 rounded-xl text-sm font-bold border-0 transition-shadow ${
            isDark
              ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 text-white shadow-[4px_4px_12px_rgba(6,182,212,0.4),-2px_-2px_8px_rgba(255,255,255,0.05)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.4),inset_-2px_-2px_5px_rgba(6,182,212,0.2)]'
              : 'bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-[4px_4px_12px_rgba(6,182,212,0.35),-2px_-2px_8px_rgba(255,255,255,0.8)] active:shadow-[inset_3px_3px_7px_rgba(6,182,212,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.5)]'
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
              whileTap={{ scale: 0.96 }}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-bold whitespace-nowrap border-0 transition-shadow ${
                statusFilter === key
                  ? isDark
                    ? `bg-gradient-to-br ${config.gradient} text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.06)]`
                    : `bg-gradient-to-br ${config.gradient} text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.15),inset_-2px_-2px_5px_rgba(255,255,255,0.25)]`
                  : isDark
                  ? 'bg-[#1a2235] text-white/60 shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:text-white/80'
                  : 'bg-[#e8f4fb] text-gray-500 shadow-[4px_4px_10px_rgba(163,196,215,0.6),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:text-gray-700'
              }`}
            >
              <div className={statusFilter === key ? '' : 'opacity-60'}>
                {config.icon}
              </div>
              <span>{config.label}</span>
              <span className={`min-w-[28px] h-6 flex items-center justify-center px-2 rounded-lg text-xs font-black ${
                statusFilter === key
                  ? 'bg-white/25 text-white'
                  : isDark
                  ? 'bg-[#151b2b] text-white/50 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.04)]'
                  : 'bg-[#dceef8] text-gray-600 shadow-[inset_2px_2px_4px_rgba(163,196,215,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]'
              }`}>
                {config.count}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Service Jobs List */}
      <div className={`rounded-2xl mt-4 p-4 ${
        isDark
          ? 'bg-[#151b2b] shadow-[inset_3px_3px_8px_rgba(0,0,0,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.03)]'
          : 'bg-[#e8f4fb] shadow-[inset_3px_3px_8px_rgba(163,196,215,0.5),inset_-2px_-2px_6px_rgba(255,255,255,0.9)]'
      }`}>
        <AnimatePresence mode="popLayout">
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((job, i) => (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => setDetailJob(job)}
                    className={`rounded-2xl p-4 cursor-pointer transition-shadow ${
                      isDark
                        ? 'bg-[#1a2235] shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:shadow-[6px_6px_14px_rgba(0,0,0,0.6),-4px_-4px_10px_rgba(255,255,255,0.05)]'
                        : 'bg-[#e8f4fb] shadow-[4px_4px_10px_rgba(163,196,215,0.7),-3px_-3px_8px_rgba(255,255,255,0.95)] hover:shadow-[6px_6px_14px_rgba(163,196,215,0.8),-4px_-4px_10px_rgba(255,255,255,1)]'
                    }`}
                  >
                    <div className="flex items-start justify-between">
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
                          isDark ? 'bg-[#151b2b] text-white/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.04)]' : 'bg-[#dceef8] text-gray-600 shadow-[inset_2px_2px_4px_rgba(163,196,215,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]'
                        }`}>
                          {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-lg whitespace-nowrap ${
                          isDark ? 'bg-[#151b2b] text-white/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.04)]' : 'bg-[#dceef8] text-gray-600 shadow-[inset_2px_2px_4px_rgba(163,196,215,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]'
                        }`}>
                          {job.technicianName ? `👷 ${job.technicianName}` : '⚠️ Unassigned'}
                        </span>
                        {job.nextServiceDate && (
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                            isDark ? 'bg-[#151b2b] text-white/70 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-1px_-1px_3px_rgba(255,255,255,0.04)]' : 'bg-[#dceef8] text-gray-600 shadow-[inset_2px_2px_4px_rgba(163,196,215,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.9)]'
                          }`}>
                            📅 Next: {formatDate(job.nextServiceDate)}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-12 text-center"
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
            <div
              className="rounded-2xl p-4 space-y-3"
              style={{
                background: isDark ? '#151b2b' : '#e8f4fb',
                boxShadow: isDark
                  ? 'inset 4px 4px 10px rgba(0,0,0,0.5), inset -3px -3px 8px rgba(255,255,255,0.04)'
                  : 'inset 4px 4px 10px rgba(163,196,215,0.6), inset -3px -3px 8px rgba(255,255,255,0.9)'
              }}
            >
              <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                Review before creating
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Customer',
                    value: form.customerName,
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  },
                  {
                    label: 'Phone',
                    value: form.customerPhone,
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                  },
                  {
                    label: 'Service Type',
                    value: form.serviceType,
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth={2} /></svg>
                  },
                  {
                    label: 'Priority',
                    value: form.priority === 'urgent' ? 'Urgent' : 'Normal',
                    icon: form.priority === 'urgent'
                      ? <svg className="w-3.5 h-3.5 text-red-400" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      : <svg className="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  },
                  {
                    label: 'Assignment',
                    value: form.assignmentMode === 'broadcast' ? 'Broadcast' : (technicians.find(t => t.id === form.technicianId)?.name || '—'),
                    icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
                  },
                ].map(({ label, value, icon }) => (
                  <div
                    key={label}
                    className="rounded-xl p-3"
                    style={{
                      background: isDark ? '#1a2235' : '#e8f4fb',
                      boxShadow: isDark
                        ? '4px 4px 8px rgba(0,0,0,0.5), -2px -2px 6px rgba(255,255,255,0.04)'
                        : '4px 4px 8px rgba(163,196,215,0.6), -2px -2px 6px rgba(255,255,255,0.95)'
                    }}
                  >
                    <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      {icon}
                      <span>{label}</span>
                    </div>
                    <p className={`font-bold text-sm mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                  </div>
                ))}
                <div
                  className="col-span-2 rounded-xl p-3"
                  style={{
                    background: isDark ? '#1a2235' : '#e8f4fb',
                    boxShadow: isDark
                      ? '4px 4px 8px rgba(0,0,0,0.5), -2px -2px 6px rgba(255,255,255,0.04)'
                      : '4px 4px 8px rgba(163,196,215,0.6), -2px -2px 6px rgba(255,255,255,0.95)'
                  }}
                >
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>Address</span>
                  </div>
                  <p className={`font-bold text-sm mt-1 whitespace-pre-line ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatAddressForDisplay(form.customerAddress)}</p>
                </div>
                <div
                  className="col-span-2 rounded-xl p-3"
                  style={{
                    background: isDark ? '#1a2235' : '#e8f4fb',
                    boxShadow: isDark
                      ? '4px 4px 8px rgba(0,0,0,0.5), -2px -2px 6px rgba(255,255,255,0.04)'
                      : '4px 4px 8px rgba(163,196,215,0.6), -2px -2px 6px rgba(255,255,255,0.95)'
                  }}
                >
                  <div className={`flex items-center gap-1.5 text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span>Problem</span>
                  </div>
                  <p className={`font-bold text-sm mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{form.problemDescription}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowConfirm(false)}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold border-0 transition-shadow"
                style={{
                  background: isDark ? '#1a2235' : '#e8f4fb',
                  color: isDark ? 'rgba(255,255,255,0.7)' : '#4b5563',
                  boxShadow: isDark
                    ? '4px 4px 10px rgba(0,0,0,0.5), -3px -3px 8px rgba(255,255,255,0.04)'
                    : '4px 4px 10px rgba(163,196,215,0.6), -3px -3px 8px rgba(255,255,255,0.9)'
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Edit
              </motion.button>
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={handleCreate}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white border-0 disabled:opacity-60 disabled:cursor-not-allowed transition-shadow"
                style={{
                  background: 'linear-gradient(145deg, #10b981, #059669)',
                  boxShadow: isDark
                    ? '4px 4px 12px rgba(16,185,129,0.4), -2px -2px 8px rgba(255,255,255,0.05)'
                    : '4px 4px 12px rgba(16,185,129,0.35), -2px -2px 8px rgba(255,255,255,0.8)'
                }}
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
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm & Create
                  </>
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
                  className={`flex-1 py-3 px-3 rounded-xl text-sm font-semibold transition-shadow ${
                    form.assignmentMode === mode.key
                      ? isDark
                        ? 'bg-[#151b2b] text-white border-2 border-white/40 shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
                        : 'bg-[#e8f4fb] text-gray-800 border-2 border-gray-400 shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]'
                      : isDark
                        ? 'border border-white/10 bg-[#1a2235] text-white/60 shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:text-white/80'
                        : 'border border-gray-200 bg-[#e8f4fb] text-gray-500 shadow-[4px_4px_10px_rgba(163,196,215,0.6),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:text-gray-700'
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
                className={`w-full mt-1 border-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition-shadow ${
                  form.customerPhone.length === 10
                    ? 'focus:ring-green-400/50'
                    : form.customerPhone.length > 0
                    ? 'focus:ring-amber-400/50'
                    : 'focus:ring-cyan-400/50'
                } ${
                  isDark
                    ? 'bg-[#151b2b] text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
                    : 'bg-[#e8f4fb] text-gray-800 shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]'
                }`}
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
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-shadow ${
                        form.serviceType === t
                          ? isDark
                            ? 'bg-[#151b2b] text-white border-2 border-white/40 shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
                            : 'bg-[#e8f4fb] text-gray-800 border-2 border-gray-400 shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]'
                          : isDark
                            ? 'border border-white/10 bg-[#1a2235] text-white/60 shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:text-white/80'
                            : 'border border-gray-200 bg-[#e8f4fb] text-gray-500 shadow-[4px_4px_10px_rgba(163,196,215,0.6),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:text-gray-700'
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
                  className={`w-full mt-1 border-0 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 resize-none transition-shadow ${
                    isDark
                      ? 'bg-[#151b2b] text-white shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
                      : 'bg-[#e8f4fb] text-gray-800 shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]'
                  }`}
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
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold border-0 transition-shadow active:scale-95 ${
                isDark
                  ? 'bg-[#1a2235] text-white/70 shadow-[4px_4px_10px_rgba(0,0,0,0.5),-3px_-3px_8px_rgba(255,255,255,0.04)] hover:text-white active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]'
                  : 'bg-[#e8f4fb] text-gray-600 shadow-[4px_4px_10px_rgba(163,196,215,0.6),-3px_-3px_8px_rgba(255,255,255,0.9)] hover:text-gray-800 active:shadow-[inset_3px_3px_7px_rgba(163,196,215,0.6),inset_-2px_-2px_5px_rgba(255,255,255,0.9)]'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white border-0 transition-shadow active:scale-95 ${
                isDark
                  ? 'bg-gradient-to-br from-cyan-500 to-cyan-700 shadow-[4px_4px_12px_rgba(6,182,212,0.4),-2px_-2px_8px_rgba(255,255,255,0.05)] active:shadow-[inset_3px_3px_7px_rgba(0,0,0,0.4),inset_-2px_-2px_5px_rgba(6,182,212,0.2)]'
                  : 'bg-gradient-to-br from-cyan-400 to-cyan-600 shadow-[4px_4px_12px_rgba(6,182,212,0.35),-2px_-2px_8px_rgba(255,255,255,0.8)] active:shadow-[inset_3px_3px_7px_rgba(6,182,212,0.3),inset_-2px_-2px_5px_rgba(255,255,255,0.5)]'
              }`}
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

              {/* Delete button — only before technician starts work */}
              {['pending', 'assigned'].includes(detailJob.status) && (
                <button
                  onClick={() => { setDeleteConfirm(detailJob); setDetailJob(null) }}
                  className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all ${
                    isDark ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Job
                </button>
              )}

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
                  <div key={label} className={`rounded-xl p-3 ${
                    isDark
                      ? 'bg-[#1a2235] shadow-[4px_4px_8px_rgba(0,0,0,0.5),-2px_-2px_6px_rgba(255,255,255,0.04)]'
                      : 'bg-[#e8f4fb] shadow-[4px_4px_8px_rgba(163,196,215,0.6),-2px_-2px_6px_rgba(255,255,255,0.95)]'
                  }`}>
                    <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{label}</p>
                    <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</p>
                  </div>
                ))}
                <div className={`col-span-2 rounded-xl p-3 ${
                  isDark
                    ? 'bg-[#1a2235] shadow-[4px_4px_8px_rgba(0,0,0,0.5),-2px_-2px_6px_rgba(255,255,255,0.04)]'
                    : 'bg-[#e8f4fb] shadow-[4px_4px_8px_rgba(163,196,215,0.6),-2px_-2px_6px_rgba(255,255,255,0.95)]'
                }`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📍 Address</p>
                  <p className={`font-bold text-sm mt-0.5 whitespace-pre-line ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatAddressForDisplay(detailJob.customerAddress)}</p>
                </div>
                <div className={`col-span-2 rounded-xl p-3 ${
                  isDark
                    ? 'bg-[#1a2235] shadow-[4px_4px_8px_rgba(0,0,0,0.5),-2px_-2px_6px_rgba(255,255,255,0.04)]'
                    : 'bg-[#e8f4fb] shadow-[4px_4px_8px_rgba(163,196,215,0.6),-2px_-2px_6px_rgba(255,255,255,0.95)]'
                }`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📝 Problem</p>
                  <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailJob.problemDescription}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Job" size="sm">
        {deleteConfirm && (
          <div className="space-y-4">
            <div className={`rounded-xl p-4 border ${
              isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            }`}>
              <p className={`text-sm font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>⚠️ This action cannot be undone</p>
              <p className={`text-xs mt-1 ${isDark ? 'text-red-400/70' : 'text-red-600'}`}>
                Job for <span className="font-bold">{deleteConfirm.customerName}</span> will be permanently deleted.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                  isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:shadow-lg transition-all"
              >
                🗑️ Delete Job
              </button>
            </div>
          </div>
        )}
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
