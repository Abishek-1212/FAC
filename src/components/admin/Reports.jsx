import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { generateReport } from '../../utils/generateReport'
import { generateMissingInvoices } from '../../utils/bulkGenerateInvoices'

function DonutChart({ segments, size = 140, thickness = 24, label, sub }) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2, cy = size / 2
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
          ) : (
            segments.map((seg, i) => {
              const pct = seg.value / total
              const dash = pct * circ
              const el = (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                  stroke={seg.color} strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset * circ + circ * 0.25}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              )
              offset += pct
              return el
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-black text-gray-900 leading-none">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-500 whitespace-nowrap">{s.label}: {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  const { isDark } = useTheme()
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [generatingReport, setGeneratingReport] = useState(false)
  const [generatingInvoices, setGeneratingInvoices] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), s =>
      setJobs(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u2 = onSnapshot(collection(db, 'invoices'), s =>
      setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2() }
  }, [])

  // Filter data by date range
  const getDateRange = () => {
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      return { 
        start: new Date(customStartDate), 
        end: new Date(new Date(customEndDate).getTime() + 86400000)
      }
    }
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    switch(dateFilter) {
      case 'today':
        return { start: today, end: tomorrow }
      case 'week':
        const weekStart = new Date(today)
        // Set to Monday (1) - if today is Sunday (0), go back 6 days, otherwise go back to previous Monday
        const dayOfWeek = today.getDay()
        const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(today.getDate() - daysToMonday)
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

  const filterByDateRange = (items, dateField = 'createdAt') => {
    if (dateFilter === 'all') return items
    const { start, end } = getDateRange()
    return items.filter(item => {
      const itemDate = item[dateField]?.toDate ? item[dateField].toDate() : new Date(item[dateField]?.seconds * 1000 || 0)
      return itemDate >= start && itemDate < end
    })
  }

  // Filter jobs and invoices by date
  const filteredJobs = filterByDateRange(jobs)
  const filteredInvoices = filterByDateRange(invoices, 'generatedDate')

  // Jobs stats
  const totalJobs = filteredJobs.length
  const completedJobs = filteredJobs.filter(j => ['completed', 'verified'].includes(j.status)).length
  const pendingJobs = filteredJobs.filter(j => j.status === 'pending').length
  const assignedJobs = filteredJobs.filter(j => j.status === 'assigned').length
  const inProgressJobs = filteredJobs.filter(j => j.status === 'in_progress').length
  const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0

  // Revenue stats
  const totalBilled = filteredInvoices.reduce((s, i) => s + (i.billAmount || 0), 0)
  const totalReceived = filteredInvoices.reduce((s, i) => s + (i.amountReceived || 0), 0)
  const totalPending = filteredInvoices.reduce((s, i) => s + (i.paymentPending || 0), 0)
  const collectionRate = totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0

  // Service type
  const newFitting = filteredJobs.filter(j => j.serviceType === 'New Fitting').length
  const serviceRepair = filteredJobs.filter(j => j.serviceType === 'Service / Repair').length

  const card = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`
  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'

  // Get date range label for report
  const getDateRangeLabel = () => {
    const { start, end } = getDateRange()
    const formatDate = (date) => {
      const day = date.getDate()
      const month = date.toLocaleDateString('en-IN', { month: 'long' })
      const year = date.getFullYear()
      const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
      return `${day}${suffix} ${month} ${year}`
    }
    
    if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate)
      const endDate = new Date(customEndDate)
      if (startDate.toDateString() === endDate.toDateString()) {
        return formatDate(startDate)
      }
      return `${formatDate(startDate)} – ${formatDate(endDate)}`
    }
    
    switch(dateFilter) {
      case 'today':
        return formatDate(start)
      case 'week':
      case 'month':
        const endDate = new Date(end.getTime() - 86400000)
        return `${formatDate(start)} – ${formatDate(endDate)}`
      default:
        if (filteredJobs.length > 0) {
          const dates = filteredJobs.map(j => {
            const date = j.createdAt?.toDate ? j.createdAt.toDate() : new Date(j.createdAt?.seconds * 1000 || 0)
            return date.getTime()
          }).filter(t => t > 0)
          
          if (dates.length > 0) {
            const minDate = new Date(Math.min(...dates))
            const maxDate = new Date(Math.max(...dates))
            return `${formatDate(minDate)} – ${formatDate(maxDate)}`
          }
        }
        return 'All Time'
    }
  }

  // Handle generating missing invoices
  const handleGenerateMissingInvoices = async () => {
    setGeneratingInvoices(true)
    try {
      const result = await generateMissingInvoices(filteredJobs)
      if (result.success && result.created > 0) {
        toast.success(`✅ Generated ${result.created} missing invoice(s)`)
      } else if (result.created === 0) {
        toast.success('✅ All jobs already have invoices!')
      }
    } catch (error) {
      console.error('Error generating invoices:', error)
      toast.error('Failed to generate invoices')
    } finally {
      setGeneratingInvoices(false)
    }
  }

  // Handle report download
  const handleDownloadReport = () => {
    setGeneratingReport(true)
    try {
      generateReport({
        dateRange: getDateRangeLabel(),
        totalJobs,
        completedJobs,
        pendingJobs,
        assignedJobs,
        inProgressJobs,
        completionRate,
        totalBilled,
        totalReceived,
        totalPending,
        collectionRate,
        newFitting,
        serviceRepair,
        invoices: filteredInvoices,
      })
      toast.success('📥 Report downloaded successfully!')
    } catch (error) {
      console.error('Error generating report:', error)
      toast.error('Failed to generate report')
    } finally {
      setGeneratingReport(false)
    }
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div className={`flex items-center justify-center px-4 py-4 border rounded-full mx-4 mb-5 relative ${
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
          REPORTS
        </h1>
      </div>

      <div className="space-y-6">
      {/* Date Filter Pills */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {[
          { key: 'all', label: 'All Time', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
          { key: 'today', label: 'Today', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
          { key: 'week', label: 'This Week', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
          { key: 'month', label: 'This Month', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
          { key: 'custom', label: 'Custom Range', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        ].map(({ key, label, icon }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              setDateFilter(key)
              if (key === 'custom') {
                setShowCustomDatePicker(true)
              } else {
                setShowCustomDatePicker(false)
              }
            }}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${
              dateFilter === key
                ? isDark
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                  : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-lg shadow-aqua-300/40'
                : isDark
                ? 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
            }`}
          >
            {icon}
            {label}
          </motion.button>
        ))}
      </div>

      {/* Date Range Header */}
      {dateFilter !== 'all' && customStartDate && customEndDate && (
        <div className={`rounded-2xl p-4 border flex items-center justify-between ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
        }`}>
          <p className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
            {getDateRangeLabel()}
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setCustomStartDate('')
              setCustomEndDate('')
              setShowCustomDatePicker(true)
            }}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              isDark
                ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            Clear
          </motion.button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col md:flex-row gap-3 justify-center">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleGenerateMissingInvoices}
          disabled={generatingInvoices || completedJobs === 0}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-60 ${
            isDark
              ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-500/25 hover:shadow-blue-500/40'
              : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200 hover:shadow-blue-300'
          }`}
        >
          {generatingInvoices ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Generate Missing Invoices</span>
            </>
          )}
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleDownloadReport}
          disabled={generatingReport}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-all disabled:opacity-60 ${
            isDark
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-500/25 hover:shadow-emerald-500/40'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200 hover:shadow-emerald-300'
          }`}
        >
          {generatingReport ? (
            <>
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Download Report</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Custom Date Range Picker */}
      {showCustomDatePicker && dateFilter === 'custom' && (
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
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
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
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
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
            onClick={() => setShowCustomDatePicker(false)}
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

      {/* Jobs + Revenue side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Jobs Donut */}
        <div className={`${card} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
              <svg className={`w-5 h-5 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <p className={`text-xs font-bold uppercase tracking-widest ${s}`}>Service Jobs</p>
          </div>
          <div className="flex justify-center mb-6">
            <DonutChart
              label={totalJobs}
              sub="total"
              segments={[
                { label: 'Pending', value: pendingJobs, color: '#f59e0b' },
                { label: 'Assigned', value: assignedJobs, color: '#3b82f6' },
                { label: 'In Progress', value: inProgressJobs, color: '#8b5cf6' },
                { label: 'Completed', value: completedJobs, color: '#10b981' },
              ]}
            />
          </div>
          <div className={`pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${s}`}>Completion Rate</span>
              <div className="flex items-center gap-2">
                <div className={`w-24 h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${completionRate}%` }}
                    transition={{ duration: 0.7 }}
                    className={`h-full rounded-full ${completionRate >= 70 ? 'bg-green-500' : 'bg-amber-500'}`}
                  />
                </div>
                <span className={`text-lg font-black ${completionRate >= 70 ? 'text-green-500' : 'text-amber-500'}`}>{completionRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Revenue Donut */}
        <div className={`${card} p-6`}>
          <div className="flex items-center gap-3 mb-6">
            <div className={`p-2.5 rounded-xl ${isDark ? 'bg-green-500/20' : 'bg-green-100'}`}>
              <svg className={`w-5 h-5 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className={`text-xs font-bold uppercase tracking-widest ${s}`}>Revenue</p>
          </div>
          <div className="flex justify-center mb-6">
            <DonutChart
              label={`₹${totalBilled >= 1000 ? (totalBilled / 1000).toFixed(1) + 'k' : totalBilled}`}
              sub="billed"
              segments={[
                { label: 'Collected', value: totalReceived, color: '#10b981' },
                { label: 'Pending', value: totalPending, color: '#ef4444' },
              ]}
            />
          </div>
          <div className={`pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${s}`}>Collection Rate</span>
              <div className="flex items-center gap-2">
                <div className={`w-24 h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${collectionRate}%` }}
                    transition={{ duration: 0.7 }}
                    className={`h-full rounded-full ${collectionRate >= 70 ? 'bg-green-500' : 'bg-amber-500'}`}
                  />
                </div>
                <span className={`text-lg font-black ${collectionRate >= 70 ? 'text-green-500' : 'text-amber-500'}`}>{collectionRate}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Service Type */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2.5 rounded-xl ${isDark ? 'bg-purple-500/20' : 'bg-purple-100'}`}>
            <svg className={`w-5 h-5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p className={`text-xs font-bold uppercase tracking-widest ${s}`}>Service Type Breakdown</p>
            <p className={`text-sm font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{totalJobs} total services</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className={`rounded-xl p-5 border-2 transition-all ${isDark ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30 hover:border-blue-500/50' : 'bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200 hover:border-blue-300 hover:shadow-lg'}`}
          >
            <div className="mb-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>New Fitting</p>
            </div>
            <p className={`text-4xl font-black mb-1 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{newFitting}</p>
            <p className={`text-xs font-semibold ${isDark ? 'text-blue-300/60' : 'text-blue-500/60'}`}>installations</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className={`rounded-xl p-5 border-2 transition-all ${isDark ? 'bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30 hover:border-orange-500/50' : 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-200 hover:border-orange-300 hover:shadow-lg'}`}
          >
            <div className="mb-3">
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>Service/Repair</p>
            </div>
            <p className={`text-4xl font-black mb-1 ${isDark ? 'text-orange-400' : 'text-orange-600'}`}>{serviceRepair}</p>
            <p className={`text-xs font-semibold ${isDark ? 'text-orange-300/60' : 'text-orange-500/60'}`}>services</p>
          </motion.div>
        </div>
        {totalJobs > 0 && (
          <div>
            <div className={`w-full h-3 rounded-full overflow-hidden flex ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(newFitting / totalJobs) * 100}%` }}
                transition={{ duration: 0.7 }}
                className="h-full bg-blue-500 relative"
              >
                {newFitting > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                    {Math.round((newFitting / totalJobs) * 100)}%
                  </span>
                )}
              </motion.div>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(serviceRepair / totalJobs) * 100}%` }}
                transition={{ duration: 0.7, delay: 0.1 }}
                className="h-full bg-orange-500 relative"
              >
                {serviceRepair > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-white">
                    {Math.round((serviceRepair / totalJobs) * 100)}%
                  </span>
                )}
              </motion.div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
