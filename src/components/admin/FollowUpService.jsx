import { useEffect, useState } from 'react'
import peopleImg from '../../Assets/people.png'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function FollowUpService() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [completedJobs, setCompletedJobs] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [assignmentMode, setAssignmentMode] = useState('broadcast')
  const [selectedTechnician, setSelectedTechnician] = useState('')
  const [creating, setCreating] = useState(false)
  const [dateRange, setDateRange] = useState('today')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')

  const getDateRange = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (dateRange === 'today') {
      return { start: today, end: tomorrow }
    } else if (dateRange === 'week') {
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      return { start: weekStart, end: weekEnd }
    } else if (dateRange === 'custom' && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate),
        end: new Date(new Date(customEndDate).setDate(new Date(customEndDate).getDate() + 1))
      }
    } else if (dateRange === 'all') {
      return null
    }
    return null
  }

  const getNextDueDate = (job) => {
    if (job.nextServiceDate) {
      return job.nextServiceDate.toDate ? job.nextServiceDate.toDate() : new Date(job.nextServiceDate.seconds * 1000)
    }
    const completedDate = job.completedAt?.toDate ? job.completedAt.toDate() : new Date((job.completedAt?.seconds || job.createdAt?.seconds || 0) * 1000)
    const d = new Date(completedDate)
    d.setMonth(d.getMonth() + 3)
    return d
  }

  const filterJobsByDateRange = (jobs) => {
    const range = getDateRange()
    if (!range) return jobs
    return jobs.filter(job => {
      const nextDueDate = getNextDueDate(job)
      return nextDueDate >= range.start && nextDueDate < range.end
    })
  }

  useEffect(() => {
    // Load completed jobs that haven't been moved to follow-up yet
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('status', 'in', ['completed', 'verified'])),
      snap => {
        const jobs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(job => !job.movedToFollowUp && !job.isFollowUp && job.serviceType === 'New Fitting')
          .sort((a, b) => (b.completedAt?.seconds || b.createdAt?.seconds || 0) - (a.completedAt?.seconds || a.createdAt?.seconds || 0))
        
        const sortByDueDate = (list) => [...list].sort((a, b) => getNextDueDate(a) - getNextDueDate(b))

        let filtered = jobs
        if (dateRange === 'all') {
          filtered = sortByDueDate(jobs)
        } else if (dateRange === 'today' || dateRange === 'week' || dateRange === 'custom') {
          filtered = sortByDueDate(filterJobsByDateRange(jobs))
        }
        setCompletedJobs(filtered)
      }
    )

    // Load technicians
    const u2 = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    return () => { u1(); u2() }
  }, [dateRange, customStartDate, customEndDate])

  const handleScheduleFollowUp = async () => {
    if (!selectedJob) {
      toast.error('Please select a job')
      return
    }

    // Store selected job in sessionStorage to prefill the form
    sessionStorage.setItem('prefillFollowUpData', JSON.stringify({
      customerName: selectedJob.customerName,
      customerPhone: selectedJob.customerPhone,
      customerAddress: selectedJob.customerAddress,
      problemDescription: 'Follow-up service after 3 months',
      serviceType: 'Service / Repair',
      originalJobId: selectedJob.id,
      isFollowUp: true,
      movedToFollowUp: true
    }))

    // Navigate to service jobs page
    navigate('/admin/jobs')
  }

  const formatAddress = (addr) => {
    if (!addr) return '—'
    if (typeof addr === 'string') return addr
    return [addr.houseNo, addr.building, addr.street, addr.locality, addr.city, addr.state, addr.pinCode, addr.landmark]
      .filter(Boolean).join('\n')
  }

  const formatDate = (ts, monthsToAdd = 0) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    if (monthsToAdd > 0) {
      d.setMonth(d.getMonth() + monthsToAdd)
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="pb-20 md:pb-0">
      {/* Header */}
      <div className={`flex items-center justify-center px-4 py-4 border rounded-full mx-4 relative ${
        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={() => navigate('/admin')}
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
        <h1 className={`text-base sm:text-xl font-bold px-12 text-center ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          SCHEDULE FOLLOW-UP SERVICE
        </h1>
      </div>

      <div className="space-y-5 mt-5">
        {/* Date Range Filter */}
        <div className={`rounded-2xl p-5 border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide mb-3">
            <div className="flex gap-2 flex-shrink-0">
              {[
                { key: 'today', label: 'Today' },
                { key: 'week', label: 'This Week' },
                { key: 'all', label: 'All Services' },
                { key: 'custom', label: 'Custom Range' }
              ].map(range => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setDateRange(range.key)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0 ${
                    dateRange === range.key
                      ? isDark ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500' : 'bg-cyan-50 text-cyan-700 border border-cyan-500'
                      : isDark ? 'bg-white/5 text-white/60 border border-white/10 hover:border-white/20' : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          {/* Display selected date range */}
          {dateRange !== 'custom' && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${
              isDark ? 'bg-white/5 text-white/60' : 'bg-gray-50 text-gray-600'
            }`}>
              {dateRange === 'today' && `Today: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
              {dateRange === 'week' && (() => {
                const now = new Date()
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
                const weekStart = new Date(today)
                weekStart.setDate(today.getDate() - today.getDay())
                const weekEnd = new Date(weekStart)
                weekEnd.setDate(weekEnd.getDate() + 6)
                return `${weekStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to ${weekEnd.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
              })()}
              {dateRange === 'all' && 'All Services (sorted by due date)'}
            </div>
          )}

          {/* Custom Date Range Inputs */}
          {dateRange === 'custom' && (
            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                    Start
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className={`w-full border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div className="flex-1">
                  <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                    End
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className={`w-full border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
              </div>
              {customStartDate && customEndDate && (
                <div className={`text-xs font-semibold px-3 py-2 rounded-lg flex items-center justify-between ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                }`}>
                  <span>
                    {new Date(customStartDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} to {new Date(customEndDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate('')
                      setCustomEndDate('')
                    }}
                    className={`ml-3 text-lg font-semibold transition-all hover:opacity-70`}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Completed Jobs List */}
        <div className={`rounded-2xl border overflow-hidden ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
        }`}>
          <div className={`px-5 py-4 border-b ${
            isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
          }`}>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Select Completed Job
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
              {completedJobs.length} completed jobs available
            </p>
          </div>

          <div className="p-4 max-h-[60vh] overflow-y-auto">
            {completedJobs.length > 0 ? (
              <div className="space-y-2">
                {completedJobs.map((job) => (
                  <motion.div
                    key={job.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelectedJob(job)}
                    className={`rounded-xl p-4 border-2 cursor-pointer transition-all ${
                      selectedJob?.id === job.id
                        ? isDark
                          ? 'border-purple-500 bg-purple-500/20'
                          : 'border-purple-500 bg-purple-50'
                        : isDark
                        ? 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                        : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
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
                        <p className={`text-xs mt-1 whitespace-pre-line ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                          📍 {formatAddress(job.customerAddress)}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                          isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-600'
                        }`}>
                          ✅ {job.status === 'verified' ? 'Verified' : 'Completed'}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap ${
                          isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                        }`}>
                          👷 {job.technicianName || 'N/A'}
                        </span>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 ${
                            isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-700'
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Next: {getNextDueDate(job).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded-lg whitespace-nowrap flex items-center gap-1 ${
                            isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'
                          }`}>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            Fitted: {formatDate(job.completedAt || job.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">📋</p>
                <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  No completed jobs found
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Button */}
        {selectedJob && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={handleScheduleFollowUp}
            disabled={creating}
            className={`w-full rounded-xl py-4 text-sm font-bold text-white disabled:opacity-60 transition-all flex items-center justify-center gap-2 ${
              isDark
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-md'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {creating ? 'Creating Follow-up Service...' : 'Schedule Follow-up Service'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
