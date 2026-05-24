import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'
import InvoiceModal from '../common/InvoiceModal'
import { generateInvoice } from '../../utils/generateInvoice'

export default function CompletionReports() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [periodFilter, setPeriodFilter] = useState('today')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [invoiceModal, setInvoiceModal] = useState(false)
  const [selectedReportForInvoice, setSelectedReportForInvoice] = useState(null)
  const [invoiceStatus, setInvoiceStatus] = useState({}) // Track which jobs have invoices
  const [viewInvoiceModal, setViewInvoiceModal] = useState(false)
  const [selectedInvoiceData, setSelectedInvoiceData] = useState(null)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'job_completion_reports'), where('technicianId', '==', user.uid)),
      snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)))
    )
  }, [user])

  // Check invoice status for all reports
  useEffect(() => {
    if (reports.length === 0) return
    const checkInvoices = async () => {
      const status = {}
      for (const report of reports) {
        const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', report.jobId)))
        if (invoicesSnap.docs.length > 0) {
          const invoice = invoicesSnap.docs[0].data()
          status[report.jobId] = {
            exists: true,
            updatedToAdmin: invoice.updatedToAdmin || false
          }
        }
      }
      setInvoiceStatus(status)
    }
    checkInvoices()
  }, [reports])

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateOnly = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
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
        const dayOfWeek = today.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(today.getDate() - daysFromMonday)
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

  const filterReportsByDateRange = () => {
    const { start, end } = getDateRange()
    return reports.filter(r => {
      const reportDate = r.completedAt?.toDate ? r.completedAt.toDate() : new Date(r.completedAt?.seconds * 1000 || 0)
      return reportDate >= start && reportDate < end
    })
  }

  const groupReportsByDate = (reportsList) => {
    const grouped = {}
    reportsList.forEach(report => {
      const dateKey = formatDateOnly(report.completedAt)
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(report)
    })
    return grouped
  }

  const filteredReports = filterReportsByDateRange()
  const groupedReports = groupReportsByDate(filteredReports)

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Completion Reports</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{filteredReports.length} reports</p>
      </div>

      {/* Period Filter Pills */}
      {reports.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'custom', label: 'Custom Range' },
          ].map(({ key, label }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setPeriodFilter(key)
                if (key === 'custom') setShowDatePicker(true)
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                periodFilter === key
                  ? isDark
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </motion.button>
          ))}
        </div>
      )}

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
                    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
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
                    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                } focus:outline-none`}
              />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDatePicker(false)}
            className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
              isDark
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Apply Range
          </motion.button>
        </motion.div>
      )}

      {/* Reports List - Grouped by Date */}
      <AnimatePresence mode="popLayout">
        <div className="space-y-6">
          {Object.keys(groupedReports).length > 0 ? (
            Object.entries(groupedReports).map(([date, dateReports], dateIndex) => (
              <motion.div
                key={date}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dateIndex * 0.05 }}
                className="space-y-3"
              >
                {/* Date Header */}
                <div className={`sticky top-0 z-10 backdrop-blur-sm py-2 px-4 rounded-xl border ${
                  isDark
                    ? 'bg-dark-card/80 border-white/10'
                    : 'bg-white/80 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {date}
                      </h3>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {dateReports.length} report{dateReports.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Reports for this date */}
                <div className="grid gap-3">
                  {dateReports.map((report, i) => (
                    <motion.div
                      key={report.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.97 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-2xl p-4 shadow-sm border transition-all ${
                        isDark
                          ? 'bg-dark-card border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
                          : 'bg-white border-gray-100 hover:shadow-md hover:border-aqua-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div 
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => setSelectedReport(report)}
                        >
                          <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {report.customerName}
                          </p>
                          <div className="space-y-1 mt-2">
                            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              <span className="font-medium">{report.customerPhone}</span>
                            </div>
                            <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="font-medium">{formatDate(report.completedAt).split(',')[1]?.trim() || formatDate(report.completedAt)}</span>
                            </div>
                          </div>
                          {report.serviceType && (
                            <span className={`mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                              report.serviceType === 'New Fitting'
                                ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                                : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-700'
                            }`}>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{report.serviceType}</span>
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col items-end gap-2 flex-shrink-0">
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                            isDark
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span>Completed</span>
                          </span>
                          {report.totalUnaccounted > 0 && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                              isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                            }`}>
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                              <span>{report.totalUnaccounted} Unaccounted</span>
                            </span>
                          )}
                          {/* Show Invoice button if no invoice exists, or View Invoice + Updated text if invoice exists */}
                          {!invoiceStatus[report.jobId]?.exists ? (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedReportForInvoice(report)
                                setInvoiceModal(true)
                              }}
                              className={`w-full text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                                isDark
                                  ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              <span>Invoice</span>
                            </motion.button>
                          ) : (
                            <div className="flex flex-col gap-2 w-full">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', report.jobId)))
                                  if (invoicesSnap.docs.length > 0) {
                                    setSelectedInvoiceData({ invoice: invoicesSnap.docs[0].data(), report })
                                    setViewInvoiceModal(true)
                                  }
                                }}
                                className={`w-full text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap transition-all flex items-center justify-center gap-1.5 ${
                                  isDark
                                    ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30'
                                    : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                                }`}
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                <span>View Invoice</span>
                              </motion.button>
                              <span className={`w-full text-xs font-bold px-3 py-1.5 rounded-lg flex items-center justify-center gap-1.5 ${
                                isDark
                                  ? 'bg-gray-500/20 text-gray-400'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                                <span>Updated to Admin</span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))
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
                {reports.length === 0 ? 'No completion reports yet' : 'No reports for selected period'}
              </p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

      {/* Report Detail Modal */}
      <Modal open={!!selectedReport} onClose={() => setSelectedReport(null)} title="Job Completion Report" size="lg">
        {selectedReport && (
          <div className="space-y-4">
            {/* Job Info */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Customer</p>
              <p className={`text-lg font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedReport.customerName}</p>
              <p className={`text-sm mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>📞 {selectedReport.customerPhone}</p>
            </div>

            {/* Service Details */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Service Details</p>
              <div className="mt-2 space-y-1">
                <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="font-semibold">Type:</span> {selectedReport.serviceType}
                </p>
                <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="font-semibold">Completed:</span> {formatDate(selectedReport.completedAt)}
                </p>
              </div>
            </div>

            {/* Problem Description */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Problem Description</p>
              <p className={`text-sm mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedReport.problemDescription}</p>
            </div>

            {/* Items Summary */}
            {selectedReport.itemsSummary && selectedReport.itemsSummary.length > 0 && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Items Summary</p>
                <div className="mt-3 space-y-2">
                  {selectedReport.itemsSummary?.map((item, i) => (
                    <div key={i} className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                      <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.productName}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                        <div>
                          <p className={`${isDark ? 'text-white/40' : 'text-gray-500'}`}>Assigned</p>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.assigned}</p>
                        </div>
                        <div>
                          <p className={`${isDark ? 'text-white/40' : 'text-gray-500'}`}>Used</p>
                          <p className="font-bold text-emerald-600">{item.used}</p>
                        </div>
                        <div>
                          <p className={`${isDark ? 'text-white/40' : 'text-gray-500'}`}>Damaged</p>
                          <p className="font-bold text-red-600">{item.damaged}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personal Stock Usage */}
            {selectedReport.personalStockUsage && selectedReport.personalStockUsage.length > 0 && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Personal Stock Used</p>
                <div className="mt-3 space-y-2">
                  {selectedReport.personalStockUsage?.map((item, i) => (
                    <div key={i} className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                      <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.productName}</p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                        <div>
                          <p className={`${isDark ? 'text-white/40' : 'text-gray-500'}`}>Used</p>
                          <p className="font-bold text-emerald-600">{item.used}</p>
                        </div>
                        <div>
                          <p className={`${isDark ? 'text-white/40' : 'text-gray-500'}`}>Damaged</p>
                          <p className="font-bold text-red-600">{item.damaged}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Completion Notes */}
            {selectedReport.completionNotes && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Notes</p>
                <p className={`text-sm mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedReport.completionNotes}</p>
              </div>
            )}

            {/* Unaccounted Items Warning */}
            {selectedReport.totalUnaccounted > 0 && (
              <div className={`rounded-xl p-4 border ${
                isDark
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-amber-50 border-amber-200'
              }`}>
                <p className={`text-sm font-bold ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
                  ⚠️ {selectedReport.totalUnaccounted} item{selectedReport.totalUnaccounted !== 1 ? 's' : ''} unaccounted for
                </p>
                <p className={`text-xs mt-1 ${isDark ? 'text-amber-300/70' : 'text-amber-600'}`}>
                  These items will be verified by admin during return verification
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Invoice Modal */}
      {selectedReportForInvoice && (
        <InvoiceModal
          open={invoiceModal}
          onClose={() => {
            setInvoiceModal(false)
            setSelectedReportForInvoice(null)
          }}
          job={{
            id: selectedReportForInvoice.jobId,
            customerName: selectedReportForInvoice.customerName,
            customerPhone: selectedReportForInvoice.customerPhone,
            customerAddress: selectedReportForInvoice.customerAddress,
            technicianName: selectedReportForInvoice.technicianName,
            serviceType: selectedReportForInvoice.serviceType,
            completedAt: selectedReportForInvoice.completedAt,
            problemDescription: selectedReportForInvoice.problemDescription,
          }}
          isDark={isDark}
          onInvoiceSaved={() => {
            // Refresh invoice status after save
            const checkInvoice = async () => {
              const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', selectedReportForInvoice.jobId)))
              if (invoicesSnap.docs.length > 0) {
                const invoice = invoicesSnap.docs[0].data()
                setInvoiceStatus(prev => ({
                  ...prev,
                  [selectedReportForInvoice.jobId]: {
                    exists: true,
                    updatedToAdmin: invoice.updatedToAdmin || false
                  }
                }))
              }
            }
            checkInvoice()
          }}
        />
      )}


      {/* View Invoice Modal */}
      <Modal 
        open={viewInvoiceModal} 
        onClose={() => {
          setViewInvoiceModal(false)
          setSelectedInvoiceData(null)
        }} 
        title="Invoice Actions" 
        size="md"
      >
        {selectedInvoiceData && (
          <div className="space-y-4">
            <div className={`rounded-xl p-6 ${isDark ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gradient-to-r from-purple-500 to-blue-500'} text-white`}>
              <h2 className="text-2xl font-black">📄 Invoice #{selectedInvoiceData.invoice.billNo}</h2>
              <p className="text-white/80 text-sm mt-2">{selectedInvoiceData.report.customerName}</p>
            </div>

            <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
              <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Grand Total</p>
              <p className={`text-2xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{(selectedInvoiceData.invoice.billAmount || 0).toFixed(2)}</p>
            </div>

            <div className="flex gap-3">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  generateInvoice({
                    invoiceNumber: selectedInvoiceData.invoice.billNo,
                    customerName: selectedInvoiceData.report.customerName || 'N/A',
                    customerPhone: selectedInvoiceData.report.customerPhone || 'N/A',
                    customerAddress: selectedInvoiceData.report.customerAddress || 'N/A',
                    technicianName: selectedInvoiceData.report.technicianName || 'N/A',
                    serviceType: selectedInvoiceData.report.serviceType || 'N/A',
                    problemDescription: selectedInvoiceData.report.problemDescription || 'N/A',
                    totalAmount: selectedInvoiceData.invoice.totalAmount || 0,
                    discountType: selectedInvoiceData.invoice.discountType || 'percentage',
                    discountValue: selectedInvoiceData.invoice.discountValue || 0,
                    discountAmount: selectedInvoiceData.invoice.discountAmount || 0,
                    grandTotal: selectedInvoiceData.invoice.billAmount || 0,
                    products: (selectedInvoiceData.invoice.components || []).map(c => ({
                      name: c.name || 'N/A',
                      qty: c.quantity || 0
                    })),
                  })
                  toast.success('📥 Invoice downloaded!')
                }}
                className={`flex-1 rounded-xl py-3.5 text-sm font-bold text-white transition ${
                  isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                📥 Download
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const phone = selectedInvoiceData.report.customerPhone.replace(/\D/g, '')
                  const message = `Hi ${selectedInvoiceData.report.customerName}, your invoice for ${selectedInvoiceData.report.serviceType} service is ready. Invoice #${selectedInvoiceData.invoice.billNo}`
                  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                  window.open(whatsappUrl, '_blank')
                  toast.success('✅ Invoice shared!')
                }}
                className={`flex-1 rounded-xl py-3.5 text-sm font-bold text-white transition ${
                  isDark ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                }`}
              >
                📤 Share
              </motion.button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
