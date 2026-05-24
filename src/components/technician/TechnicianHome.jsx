import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import InvoiceModal from '../common/InvoiceModal'
import toast from 'react-hot-toast'

const STATUS_META_LIGHT = {
  pending:     { color: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400', icon: '⏳', label: 'Pending' },
  assigned:    { color: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-400', icon: '📋', label: 'Assigned' },
  in_progress: { color: 'bg-violet-100 text-violet-700 border-violet-200',    dot: 'bg-violet-400', icon: '🔄', label: 'In Progress' },
  completed:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: '✅', label: 'Completed' },
  verified:    { color: 'bg-green-100 text-green-700 border-green-200',       dot: 'bg-green-400', icon: '✔️', label: 'Verified' },
}

const STATUS_META_DARK = {
  pending:     { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',       dot: 'bg-amber-400', icon: '⏳', label: 'Pending' },
  assigned:    { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',          dot: 'bg-blue-400', icon: '📋', label: 'Assigned' },
  in_progress: { color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',    dot: 'bg-violet-400', icon: '🔄', label: 'In Progress' },
  completed:   { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', icon: '✅', label: 'Completed' },
  verified:    { color: 'bg-green-500/20 text-green-300 border-green-500/30',       dot: 'bg-green-400', icon: '✔️', label: 'Verified' },
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function TechnicianHome() {
  const { user, profile, logout } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [availableJobs, setAvailableJobs] = useState([])
  const [showAvailable, setShowAvailable] = useState(false)
  const [statusFilter, setStatusFilter] = useState('active')
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState(null)
  const [stockMenuOpen, setStockMenuOpen] = useState(false)

  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  useEffect(() => {
    if (!user) return
    
    // Get today's date range (start and end of today)
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayEnd = new Date(todayStart)
    todayEnd.setDate(todayEnd.getDate() + 1)
    
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid)),
      snap => {
        const allJobs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Filter jobs to only show today's jobs
        const todayJobs = allJobs.filter(job => {
          // Check createdAt date
          if (job.createdAt) {
            const jobDate = job.createdAt.toDate ? job.createdAt.toDate() : new Date(job.createdAt.seconds * 1000)
            return jobDate >= todayStart && jobDate < todayEnd
          }
          return false
        })
        
        setJobs(todayJobs.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      }
    )
    
    const u2 = onSnapshot(
      query(collection(db, 'service_jobs'), where('assignmentMode', '==', 'broadcast'), where('status', '==', 'pending')),
      snap => {
        const allAvailable = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Filter available jobs to only show today's jobs
        const todayAvailable = allAvailable.filter(job => {
          if (job.createdAt) {
            const jobDate = job.createdAt.toDate ? job.createdAt.toDate() : new Date(job.createdAt.seconds * 1000)
            return jobDate >= todayStart && jobDate < todayEnd
          }
          return false
        })
        
        setAvailableJobs(todayAvailable.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
      }
    )
    
    return () => { u1(); u2() }
  }, [user])

  const handleAcceptJob = async (jobId) => {
    try {
      await updateDoc(doc(db, 'service_jobs', jobId), {
        technicianId: user.uid,
        technicianName: profile?.name || 'Technician',
        status: 'assigned',
        assignedAt: serverTimestamp(),
      })
      toast.success('✅ Job accepted!')
      setShowAvailable(false)
    } catch (err) {
      toast.error(err.message)
    }
  }



  const active = jobs.filter(j => ['assigned', 'in_progress'].includes(j.status))
  const pending = jobs.filter(j => j.status === 'pending')
  const completed = jobs.filter(j => ['completed', 'verified'].includes(j.status))
  const total = jobs

  const filtered = statusFilter === 'active' ? active : statusFilter === 'completed' ? completed : total

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const stats = [
    { label: 'Active', value: active.length, icon: '🔄', color: 'from-violet-500 to-violet-600' },
    { label: 'Pending', value: pending.length, icon: '⏳', color: 'from-amber-500 to-amber-600' },
    { label: 'Completed', value: completed.length, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
  ]

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2"
      >
        <p className={`text-sm font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Welcome back,</p>
        <h2 className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name || 'Technician'}</h2>
      </motion.div>

      {/* Navigation Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'My Reports', path: '/technician/reports' },
          { label: 'My Stock', path: '/technician/stock' },
          { label: 'Take Stock', path: '/technician/take-stock' },
          { label: 'My Attendance', path: '/technician/attendance' },
        ].map((card, i) => (
          <motion.button
            key={card.path}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate(card.path)}
            className={`rounded-2xl p-4 border-2 transition-all ${
              isDark 
                ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20 hover:border-blue-500/50' 
                : 'bg-blue-50 border-blue-200 hover:bg-blue-100 hover:border-blue-300'
            }`}
          >
            <p className={`font-black text-sm text-center ${isDark ? 'text-blue-300' : 'text-blue-900'}`}>{card.label}</p>
          </motion.button>
        ))}
      </div>

      {/* Available Jobs Section */}
      {availableJobs.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 border ${isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                📢 {availableJobs.length} Job{availableJobs.length !== 1 ? 's' : ''} Available
              </p>
              <p className={`text-xs ${isDark ? 'text-blue-300/70' : 'text-blue-600'}`}>
                Tap to view and accept available jobs
              </p>
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAvailable(!showAvailable)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                isDark
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {showAvailable ? 'Hide' : 'View'}
            </motion.button>
          </div>

          {showAvailable && (
            <div className="space-y-2 mt-3">
              {availableJobs.map((job, i) => (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-xl p-3 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {job.customerName}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                        📞 {job.customerPhone}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                        📍 {job.customerAddress}
                      </p>
                    </div>
                    {job.priority === 'urgent' && (
                      <span className="text-xs font-bold px-2 py-1 rounded-full bg-red-500/20 text-red-300">
                        🔴 Urgent
                      </span>
                    )}
                  </div>
                  <p className={`text-xs mb-2 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                    {job.serviceType} • {formatDate(job.createdAt)}
                  </p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleAcceptJob(job.id)}
                    className={`w-full py-2 rounded-lg text-xs font-bold transition-all ${
                      isDark
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-green-500 text-white hover:bg-green-600'
                    }`}
                  >
                    Accept Job
                  </motion.button>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Divider */}
      {availableJobs.length > 0 && (
        <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
      )}

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { key: 'active', label: 'Active', count: active.length },
          { key: 'completed', label: 'Completed', count: completed.length },
          { key: 'all', label: 'All', count: total.length },
        ].map(({ key, label, count }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setStatusFilter(key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              statusFilter === key
                ? isDark
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-600 text-white'
                : isDark
                ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
              statusFilter === key
                ? 'bg-white/20 text-white'
                : isDark ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-500'
            }`}>
              {count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Jobs List */}
      {jobs.length > 0 ? (
        <AnimatePresence mode="popLayout">
          <div className="grid gap-3">
            {filtered.map((job, i) => {
              const meta = STATUS_META[job.status] || STATUS_META.pending
              const isUrgent = job.priority === 'urgent'

              return (
                <motion.div
                  key={job.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.04, duration: 0.25 }}
                  onClick={() => navigate(`/technician/job/${job.id}`)}
                  className={`rounded-2xl p-3 md:p-4 shadow-sm border cursor-pointer transition-all group ${
                    isDark
                      ? 'bg-dark-card border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
                      : 'bg-white border-gray-100 hover:shadow-md hover:border-aqua-200'
                  }`}
                >
                  {/* Top Row: Customer Name & Status */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <p className={`font-bold text-sm md:text-base truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {job.customerName}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 whitespace-nowrap ${meta.color}`}>
                      {meta.icon} {meta.label}
                    </span>
                  </div>

                  {/* Contact Info */}
                  <div className={`text-xs space-y-1.5 ml-4 mb-3 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                    <div className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      <p className="truncate font-medium">{job.customerPhone}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <svg className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <p className="truncate flex-1 font-medium">{job.customerAddress}</p>
                    </div>
                  </div>

                  {/* Bottom Row: Service Type, Date, Priority */}
                  <div className="flex flex-wrap items-center justify-between gap-2 ml-4">
                    <div className="flex flex-wrap items-center gap-2">
                    {job.serviceType && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${
                        job.serviceType === 'New Fitting'
                          ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                          : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-700'
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {job.serviceType}
                      </span>
                    )}
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${
                      isDark ? 'bg-white/5 text-white/50' : 'bg-gray-100 text-gray-600'
                    }`}>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {formatDate(job.createdAt)}
                    </span>
                    {isUrgent && (
                      <span className={`text-xs px-2.5 py-1 rounded-lg font-bold whitespace-nowrap flex items-center gap-1.5 ${
                        isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                      }`}>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Urgent
                      </span>
                    )}
                    {job.status === 'in_progress' && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap flex items-center gap-1.5 ${
                        isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700'
                      }`}>
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        In Progress
                      </span>
                    )}
                    </div>
                  </div>
                </motion.div>
              )
            })}

            {filtered.length === 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`rounded-2xl p-12 text-center border border-dashed ${
                  isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                <p className="text-4xl mb-3">
                  {statusFilter === 'active' ? '🎉' : statusFilter === 'completed' ? '✅' : '📋'}
                </p>
                <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  {statusFilter === 'active' ? 'No active jobs' : statusFilter === 'completed' ? 'No completed jobs' : 'No jobs'}
                </p>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`rounded-2xl p-12 text-center border border-dashed ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-4xl mb-3">📋</p>
          <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            No assigned jobs yet. Check available jobs above!
          </p>
        </motion.div>
      )}

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

      {/* Stock Menu Modal */}
      <AnimatePresence>
        {stockMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setStockMenuOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            
            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
            >
              <div className={`rounded-3xl shadow-2xl overflow-hidden ${
                isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
              }`}>
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-2xl font-black">Stock Management</h3>
                    <button
                      onClick={() => setStockMenuOpen(false)}
                      className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <p className="text-white/80 text-sm">Choose an option below</p>
                </div>

                {/* Options */}
                <div className="p-4 space-y-3">
                  {/* Take Stock Option */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setStockMenuOpen(false)
                      navigate('/technician/take-stock')
                    }}
                    className={`w-full rounded-2xl p-5 border-2 transition-all text-left group ${
                      isDark
                        ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-500/50 hover:from-cyan-500/20 hover:to-cyan-600/20'
                        : 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200 hover:border-cyan-400 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition ${
                        isDark
                          ? 'bg-cyan-500/20 group-hover:bg-cyan-500/30'
                          : 'bg-cyan-200 group-hover:bg-cyan-300'
                      }`}>
                        <span className="text-3xl">📤</span>
                      </div>
                      <div className="flex-1">
                        <p className={`font-black text-lg mb-1 ${
                          isDark ? 'text-cyan-300' : 'text-cyan-700'
                        }`}>
                          Take Stock
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-cyan-300/70' : 'text-cyan-600'
                        }`}>
                          Request products from company inventory
                        </p>
                      </div>
                      <svg className={`w-6 h-6 transition ${
                        isDark ? 'text-cyan-300' : 'text-cyan-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.button>

                  {/* My Stock Option */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setStockMenuOpen(false)
                      navigate('/technician/stock')
                    }}
                    className={`w-full rounded-2xl p-5 border-2 transition-all text-left group ${
                      isDark
                        ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/10 border-purple-500/30 hover:border-purple-500/50 hover:from-purple-500/20 hover:to-purple-600/20'
                        : 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 hover:border-purple-400 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition ${
                        isDark
                          ? 'bg-purple-500/20 group-hover:bg-purple-500/30'
                          : 'bg-purple-200 group-hover:bg-purple-300'
                      }`}>
                        <span className="text-3xl">📦</span>
                      </div>
                      <div className="flex-1">
                        <p className={`font-black text-lg mb-1 ${
                          isDark ? 'text-purple-300' : 'text-purple-700'
                        }`}>
                          My Stock
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-purple-300/70' : 'text-purple-600'
                        }`}>
                          View your available stock and return items
                        </p>
                      </div>
                      <svg className={`w-6 h-6 transition ${
                        isDark ? 'text-purple-300' : 'text-purple-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
