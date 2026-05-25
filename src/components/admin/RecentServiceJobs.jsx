import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../context/ThemeContext'
import { formatAddressForDisplay } from '../../utils/addressFormatter'

const STATUS_META_DARK = {
  pending:     { color: 'bg-amber-500/20 text-amber-400',   dot: 'bg-amber-400' },
  assigned:    { color: 'bg-blue-500/20 text-blue-400',     dot: 'bg-blue-400' },
  in_progress: { color: 'bg-violet-500/20 text-violet-400', dot: 'bg-violet-400' },
  completed:   { color: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
}

const STATUS_META_LIGHT = {
  pending:     { color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  assigned:    { color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  in_progress: { color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  completed:   { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

const getDateKey = (job) => {
  const date = job.createdAt?.toDate?.() || (job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date())
  return date.toDateString()
}

const getDateLabel = (dateKey) => {
  const date = new Date(dateKey)
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()
  
  const formatted = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  
  if (dateKey === today) return `${formatted} (Today)`
  if (dateKey === yesterday) return `${formatted} (Yesterday)`
  return formatted
}

const groupByDate = (jobs) => {
  const groups = {}
  jobs.forEach(job => {
    const key = getDateKey(job)
    if (!groups[key]) groups[key] = []
    groups[key].push(job)
  })
  
  return Object.keys(groups)
    .sort((a, b) => new Date(b) - new Date(a))
    .map(key => ({
      key,
      label: getDateLabel(key),
      items: groups[key]
    }))
}

export default function RecentServiceJobs({ jobs = [] }) {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [touchStart, setTouchStart] = useState(0)
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  const recentFive = jobs.slice(0, 5)
  const groupedJobs = groupByDate(jobs)
  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  const onDragStart = (e) => setTouchStart(e.touches[0].clientY)
  const onDragEnd = (e) => {
    const diff = touchStart - e.changedTouches[0].clientY
    if (diff > 50) setShowModal(true)
  }

  const handleJobClick = (job) => {
    setSelectedJob(job)
  }

  const headerClass = isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-lg'
  const headerBgClass = isDark ? 'border-white/5 bg-gradient-to-r from-indigo-500/10 to-violet-500/10 hover:from-indigo-500/20 hover:to-violet-500/20' : 'border-sky-100 bg-gradient-to-r from-indigo-50 to-violet-50 hover:from-indigo-100 hover:to-violet-100'
  const rowHoverClass = isDark ? 'hover:bg-white/5' : 'hover:bg-sky-50'
  const divideClass = isDark ? 'divide-white/5' : 'divide-sky-100'

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        className={`rounded-3xl border overflow-hidden ${headerClass}`}
      >
        <div
          onClick={() => setShowModal(true)}
          onTouchStart={onDragStart}
          onTouchEnd={onDragEnd}
          className={`px-6 py-5 border-b flex items-center justify-between cursor-pointer transition group ${headerBgClass}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🔧</span>
            <div>
              <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Service Jobs
              </h3>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                {jobs.length} total jobs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${isDark ? 'bg-indigo-500/20 text-indigo-300' : 'bg-indigo-100 text-indigo-700'}`}>
              {jobs.length}
            </span>
            <span className={`text-xl transition-transform group-hover:translate-x-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              ↓
            </span>
          </div>
        </div>

        {recentFive.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🔧</p>
            <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>No jobs yet</p>
          </div>
        ) : (
          <div className={`divide-y ${divideClass}`}>
            {recentFive.map((job, i) => {
              const meta = STATUS_META[job.status] || STATUS_META.pending
              const date = job.createdAt?.toDate?.() || (job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date())
              
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                  onClick={() => handleJobClick(job)}
                  className={`px-6 py-4 flex items-center justify-between cursor-pointer transition group ${rowHoverClass}`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {job.customerName}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                        {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                      {date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Job Detail Popup */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            onClick={() => setSelectedJob(null)}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-lg rounded-3xl overflow-hidden flex flex-col my-8 ${isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}
            >
              {/* Header */}
              <div className={`px-6 py-5 border-b flex items-center justify-between ${isDark ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-white/10' : 'bg-gradient-to-r from-indigo-500 to-violet-500 border-indigo-300'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔧</span>
                  <div>
                    <h3 className="font-black text-lg text-white">Job Details</h3>
                    <p className="text-xs text-white/70">
                      {selectedJob.customerName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedJob(null)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 max-h-96">
                <div className="space-y-4">
                  {/* Status */}
                  <div className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${STATUS_META[selectedJob.status]?.color}`}>
                    <div className={`w-3 h-3 rounded-full ${STATUS_META[selectedJob.status]?.dot} animate-pulse`} />
                    <div>
                      <p className="font-bold text-sm">{selectedJob.status?.replace('_', ' ').toUpperCase()}</p>
                      <p className="text-xs opacity-70">Current job status</p>
                    </div>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>👤 Customer</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.customerName}</p>
                    </div>

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📞 Phone</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.customerPhone}</p>
                    </div>

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📅 Date</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.createdAt?.toDate?.().toLocaleDateString('en-IN') || new Date(selectedJob.createdAt?.seconds * 1000).toLocaleDateString('en-IN')}</p>
                    </div>

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>👷 Technician</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.technicianName || 'Unassigned'}</p>
                    </div>

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>⚡ Priority</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.priority === 'urgent' ? '🔴 Urgent' : '🟢 Normal'}</p>
                    </div>

                    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>🛠️ Service Type</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.serviceType || '—'}</p>
                    </div>

                    <div className={`col-span-2 rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📍 Address</p>
                      <p className={`font-bold text-sm mt-0.5 whitespace-pre-line ${isDark ? 'text-white' : 'text-gray-900'}`}>{formatAddressForDisplay(selectedJob.customerAddress)}</p>
                    </div>

                    <div className={`col-span-2 rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                      <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📝 Problem Description</p>
                      <p className={`font-bold text-sm mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedJob.problemDescription}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <button
                  onClick={() => setSelectedJob(null)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setSelectedJob(null)
                    navigate('/admin/jobs')
                  }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' : 'bg-gradient-to-r from-cyan-500 to-cyan-600'}`}
                >
                  View All Jobs
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full Modal - All Jobs */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
            onClick={() => setShowModal(false)}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className={`w-full max-w-4xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col ${isDark ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}
            >
              <div className={`sticky top-0 z-20 flex-shrink-0 px-6 py-5 border-b flex items-center justify-between ${isDark ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-white/10' : 'bg-gradient-to-r from-indigo-500 to-violet-500 border-indigo-300'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔧</span>
                  <div>
                    <h3 className="font-black text-lg text-white">All Service Jobs</h3>
                    <p className="text-xs text-white/70">
                      {jobs.length} total jobs
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition"
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {groupedJobs.length === 0 ? (
                  <div className="p-12 text-center">
                    <p className="text-4xl mb-3">🔧</p>
                    <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                      No jobs found
                    </p>
                  </div>
                ) : (
                  <div className={`divide-y ${divideClass}`}>
                    {groupedJobs.map((group) => (
                      <div key={group.key}>
                        {group.items.map((job) => {
                          const meta = STATUS_META[job.status] || STATUS_META.pending
                          const time = job.createdAt?.toDate?.() || (job.createdAt?.seconds ? new Date(job.createdAt.seconds * 1000) : new Date())
                          
                          return (
                            <motion.div
                              key={job.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ duration: prefersReducedMotion ? 0 : 0.15 }}
                              onClick={() => {
                                setShowModal(false)
                                setSelectedJob(job)
                              }}
                              className={`px-6 py-4 flex items-center justify-between cursor-pointer transition ${rowHoverClass}`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${meta.dot}`} />
                                <div className="min-w-0 flex-1">
                                  <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                    {job.customerName}
                                  </p>
                                  <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                                    {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 flex-shrink-0">
                                <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-400'}`}>
                                  {time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                                </span>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
