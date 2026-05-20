import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import InvoiceModal from '../common/InvoiceModal'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

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

const EMPTY_FORM = {
  customerName: '', customerPhone: '', customerAddress: '',
  problemDescription: '', serviceType: 'Service / Repair',
  technicianId: '', priority: 'normal',
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
  const [filter, setFilter] = useState('active')
  const [periodFilter, setPeriodFilter] = useState('today')
  const [statusFilter, setStatusFilter] = useState('active')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [selectedJobForInvoice, setSelectedJobForInvoice] = useState(null)
  const [stockModal, setStockModal] = useState(false)
  const [selectedJobForStock, setSelectedJobForStock] = useState(null)
  const [stockForm, setStockForm] = useState({ items: '' })
  const [assigningStock, setAssigningStock] = useState(false)

  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), snap =>
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    const u2 = onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap =>
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2() }
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const techName = technicians.find(t => t.id === form.technicianId)?.name || ''
      await addDoc(collection(db, 'service_jobs'), {
        ...form,
        technicianName: techName,
        status: form.technicianId ? 'assigned' : 'pending',
        stockAssigned: false,
        createdAt: serverTimestamp(),
      })
      toast.success('✅ Job created!')
      setModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAssignStock = async (e) => {
    e.preventDefault()
    if (!selectedJobForStock) return
    setAssigningStock(true)
    try {
      await updateDoc(doc(db, 'service_jobs', selectedJobForStock.id), {
        stockAssigned: true,
        stockItems: stockForm.items,
        stockAssignedAt: serverTimestamp(),
      })
      toast.success('✅ Stock assigned!')
      setStockModal(false)
      setSelectedJobForStock(null)
      setStockForm({ items: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAssigningStock(false)
    }
  }

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

  const resetStatusFilter = () => {
    setStatusFilter(periodFilter === 'today' ? 'active' : 'completed')
  }

  const active = jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status))
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

  const counts = {
    active: dateFilteredActive.length,
    completed: dateFilteredCompleted.length,
    all: dateFilteredTotal.length,
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Service Jobs</h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{jobs.length} total jobs</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setModal(true)}
          className={`px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-shadow ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + New Job
        </motion.button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'active', label: 'Active', count: counts.active, icon: '🔄' },
          { key: 'completed', label: 'Completed', count: counts.completed, icon: '✅' },
          { key: 'all', label: 'Total', count: counts.all, icon: '📊' },
        ].map(stat => (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl p-4 shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{stat.label}</p>
            <div className="flex items-end justify-between mt-2">
              <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{stat.count}</p>
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

      {/* Job cards */}
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
                onClick={() => setDetailJob(job)}
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

                {/* Bottom Row: Service Type, Date, Technician */}
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
                  {job.technicianName ? (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                    }`}>
                      👷 {job.technicianName.split(' ')[0]}
                    </span>
                  ) : (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      isDark ? 'bg-gray-500/20 text-gray-300' : 'bg-gray-100 text-gray-600'
                    }`}>
                      ⚠️
                    </span>
                  )}
                  {!job.stockAssigned && job.status !== 'completed' && job.status !== 'verified' && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedJobForStock(job)
                        setStockForm({ items: '' })
                        setStockModal(true)
                      }}
                      className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                        isDark ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      }`}
                    >
                      📦 Assign Stock
                    </motion.button>
                  )}
                  {job.stockAssigned && (
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${
                      isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                    }`}>
                      ✅ Stock Assigned
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
              <p className="text-4xl mb-3">🔧</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>No jobs found</p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

      {/* Create Job Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Service Job" size="lg">
        <form onSubmit={handleCreate} className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Customer Info Section */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Customer Information</p>
            <div className="space-y-3">
              {[
                ['customerName', 'Full Name', 'text'],
                ['customerPhone', 'Phone Number', 'tel'],
                ['customerAddress', 'Address', 'text'],
              ].map(([key, label, type]) => (
                <div key={key}>
                  <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{label}</label>
                  <input
                    type={type}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    required
                    className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                  />
                </div>
              ))}
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
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                />
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Assignment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Technician</label>
                <select
                  value={form.technicianId}
                  onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))}
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                >
                  <option value="" className="text-gray-900">Unassigned</option>
                  {technicians.map(t => <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
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
              disabled={saving}
              className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-glow-cyan-sm' : 'bg-gradient-to-r from-cyan-500 to-cyan-600'}`}
            >
              {saving ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
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
                  <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{detailJob.customerAddress}</p>
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

      {/* Assign Stock Modal */}
      <Modal open={stockModal} onClose={() => setStockModal(false)} title="Assign Stock" size="md">
        {selectedJobForStock && (
          <form onSubmit={handleAssignStock} className="space-y-4">
            <div className={`rounded-2xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
              <p className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Job</p>
              <p className={`font-bold text-sm mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJobForStock.customerName}</p>
            </div>
            <div>
              <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Stock Items</label>
              <textarea
                value={stockForm.items}
                onChange={e => setStockForm({ items: e.target.value })}
                placeholder="Enter stock items (e.g., Part A, Part B, etc.)"
                required
                rows={4}
                className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              />
            </div>
            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setStockModal(false)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigningStock}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-glow-cyan-sm' : 'bg-gradient-to-r from-cyan-500 to-cyan-600'}`}
              >
                {assigningStock ? 'Assigning...' : 'Assign Stock'}
              </button>
            </div>
          </form>
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
  )
}
