import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import InvoiceModal from '../common/InvoiceModal'

// v2.0 - Fixed completed jobs visibility

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
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [periodFilter, setPeriodFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('active')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState(null)

  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid), where('stockAssigned', '==', true)),
      snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
  }, [user])

  const getDateRange = () => {
    if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
      return { 
        start: new Date(customDateRange.start), 
        end: new Date(new Date(customDateRange.end).getTime() + 86400000)
      }
    }
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    switch(periodFilter) {
      case 'today':
        return { start: today, end: tomorrow }
      case 'week':
        const weekStart = new Date(today)
        weekStart.setDate(today.getDate() - today.getDay())
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        return { start: weekStart, end: weekEnd }
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        return { start: monthStart, end: monthEnd }
      default:
        return { start: new Date(0), end: new Date(8640000000000000) }
    }
  }

  const filterJobsByDateRange = (jobsList) => {
    const { start, end } = getDateRange()
    return jobsList.filter(j => {
      const jobDate = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt?.seconds * 1000 || 0)
      return jobDate >= start && jobDate < end
    })
  }

  const getStatusOptions = () => {
    return periodFilter === 'today' 
      ? ['active', 'completed', 'total']
      : ['completed', 'missed']
  }

  const active = jobs.filter(j => ['assigned', 'in_progress'].includes(j.status))
  const pending = jobs.filter(j => j.status === 'pending')
  const completed = jobs.filter(j => ['completed', 'verified'].includes(j.status))
  const total = jobs
  const missed = jobs.filter(j => j.status === 'pending' || j.status === 'assigned')

  const dateFilteredActive = filterJobsByDateRange(active)
  const dateFilteredCompleted = filterJobsByDateRange(completed)
  const dateFilteredMissed = filterJobsByDateRange(missed)
  const dateFilteredTotal = filterJobsByDateRange(total)

  let filtered = []
  if (periodFilter === 'today') {
    filtered = statusFilter === 'active' ? dateFilteredActive : statusFilter === 'completed' ? dateFilteredCompleted : dateFilteredTotal
  } else {
    filtered = statusFilter === 'completed' ? dateFilteredCompleted : dateFilteredMissed
  }

  const resetStatusFilter = () => {
    setStatusFilter(periodFilter === 'today' ? 'active' : 'completed')
  }

  const stats = [
    { label: 'Active', value: active.length, icon: '🔄', color: 'from-violet-500 to-violet-600' },
    { label: 'Pending', value: pending.length, icon: '⏳', color: 'from-amber-500 to-amber-600' },
    { label: 'Completed', value: completed.length, icon: '✅', color: 'from-emerald-500 to-emerald-600' },
  ]

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl p-6 text-white bg-gradient-to-r from-aqua-500 to-cyan-600 shadow-lg`}>
        <p className="text-white/70 text-sm font-medium">Welcome back 👋</p>
        <h2 className="text-3xl font-black mt-1">{profile?.name?.split(' ')[0]}</h2>
        <p className="text-white/60 text-sm mt-2">You have <span className="font-bold">{active.length}</span> active job{active.length !== 1 ? 's' : ''}</p>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl p-4 shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.value}</p>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Period Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { key: 'today', label: 'Today', icon: '📅' },
          { key: 'week', label: 'This Week', icon: '📆' },
          { key: 'month', label: 'This Month', icon: '📊' },
          { key: 'custom', label: 'Custom Range', icon: '📍' },
        ].map(({ key, label, icon }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setPeriodFilter(key)
              if (key === 'custom') setShowDatePicker(true)
              resetStatusFilter()
            }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
              periodFilter === key
                ? isDark
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-aqua-500 text-white shadow-md shadow-aqua-200'
                : isDark
                ? 'bg-white/5 text-white/60 border border-white/10 hover:border-cyan-500/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-aqua-300'
            }`}
          >
            <span>{icon}</span>
            {label}
          </motion.button>
        ))}
      </div>

      {/* Custom Date Range Picker */}
      {showDatePicker && periodFilter === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Start Date</label>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:border-cyan-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-aqua-500'
                } focus:outline-none`}
              />
            </div>
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>End Date</label>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:border-cyan-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-aqua-500'
                } focus:outline-none`}
              />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDatePicker(false)}
            className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
              isDark
                ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                : 'bg-aqua-500 text-white hover:bg-aqua-600'
            }`}
          >
            Apply Range
          </motion.button>
        </motion.div>
      )}

      {/* Status Filter Pills */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {getStatusOptions().map((key) => {
          const statusConfig = {
            active: { label: 'Active', icon: '🔄', count: dateFilteredActive.length },
            completed: { label: 'Completed', icon: '✅', count: dateFilteredCompleted.length },
            missed: { label: 'Missed', icon: '❌', count: dateFilteredMissed.length },
            total: { label: 'Total', icon: '📋', count: dateFilteredTotal.length },
          }
          const config = statusConfig[key]
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => setStatusFilter(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === key
                  ? isDark
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                    : 'bg-aqua-500 text-white shadow-md shadow-aqua-200'
                  : isDark
                  ? 'bg-white/5 text-white/60 border border-white/10 hover:border-cyan-500/30'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-aqua-300'
              }`}
            >
              <span>{config.icon}</span>
              {config.label}
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                statusFilter === key
                  ? 'bg-white/20 text-white'
                  : isDark ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-500'
              }`}>
                {config.count}
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Jobs List */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3 max-h-[calc(100vh-400px)] overflow-y-auto scrollbar-hide">
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
                <div className={`text-xs space-y-0.5 ml-4 mb-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  <p className="truncate">📞 {job.customerPhone}</p>
                  <p className="truncate">📍 {job.customerAddress}</p>
                </div>

                {/* Bottom Row: Service Type, Priority, In Progress */}
                <div className="flex flex-wrap items-center justify-between gap-2 ml-4">
                  <div className="flex flex-wrap items-center gap-2">
                  {job.serviceType && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      job.serviceType === 'New Fitting'
                        ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'
                        : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {job.serviceType === 'New Fitting' ? '🔧' : '🛠️'}
                    </span>
                  )}
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                    isDark ? 'text-white/40' : 'text-gray-400'
                  }`}>
                    📅 {formatDate(job.createdAt)}
                  </span>
                  {isUrgent && (
                    <span className={`text-xs px-2 py-1 rounded-full font-bold whitespace-nowrap ${
                      isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-600'
                    }`}>
                      🔴
                    </span>
                  )}
                  {job.status === 'in_progress' && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700'
                    }`}>
                      ⏱️
                    </span>
                  )}
                  </div>
                  {job.status === 'completed' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedJobForInvoice(job)
                        setInvoiceModal(true)
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                        isDark
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                      }`}
                    >
                      📄 Invoice
                    </motion.button>
                  )}
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
                {statusFilter === 'active' ? '🎉' : statusFilter === 'completed' ? '✅' : statusFilter === 'missed' ? '⚠️' : '📋'}
              </p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                {statusFilter === 'active' ? 'No active jobs' : statusFilter === 'completed' ? 'No completed jobs' : statusFilter === 'missed' ? 'No missed jobs' : 'No jobs'}
              </p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

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
  )
}
