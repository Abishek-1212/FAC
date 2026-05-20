import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'

export default function CompletionReports() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'job_completion_reports'), where('technicianId', '==', user.uid)),
      snap => setReports(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)))
    )
  }, [user])

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Completion Reports</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{reports.length} total reports</p>
      </div>

      {/* Reports List */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3">
          {reports.map((report, i) => (
            <motion.div
              key={report.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => setSelectedReport(report)}
              className={`rounded-2xl p-4 shadow-sm border cursor-pointer transition-all ${
                isDark
                  ? 'bg-dark-card border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
                  : 'bg-white border-gray-100 hover:shadow-md hover:border-aqua-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {report.customerName}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    📞 {report.customerPhone}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    📅 {formatDate(report.completedAt)}
                  </p>
                  {report.serviceType && (
                    <span className={`mt-2 inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${
                      report.serviceType === 'New Fitting'
                        ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'
                        : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-600'
                    }`}>
                      {report.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                    </span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}>
                    ✅ Completed
                  </span>
                  {report.totalUnaccounted > 0 && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600'
                    }`}>
                      ⚠️ {report.totalUnaccounted} Unaccounted
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}

          {reports.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-2xl p-12 text-center border border-dashed ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              <p className="text-4xl mb-3">📋</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                No completion reports yet
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
    </div>
  )
}
