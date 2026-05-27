import { useEffect, useState } from 'react'
import peopleImg from '../../Assets/people.png'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore'
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

  useEffect(() => {
    // Load completed jobs
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('status', 'in', ['completed', 'verified'])),
      snap => {
        const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.completedAt?.seconds || a.createdAt?.seconds || 0) - (b.completedAt?.seconds || b.createdAt?.seconds || 0))
        setCompletedJobs(jobs)
      }
    )

    // Load technicians
    const u2 = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    return () => { u1(); u2() }
  }, [])

  const handleScheduleFollowUp = async () => {
    if (!selectedJob) {
      toast.error('Please select a job')
      return
    }

    if (assignmentMode === 'direct' && !selectedTechnician) {
      toast.error('Please select a technician')
      return
    }

    setCreating(true)
    try {
      const techName = assignmentMode === 'direct' 
        ? technicians.find(t => t.id === selectedTechnician)?.name || ''
        : ''

      const followUpJobData = {
        customerName: selectedJob.customerName,
        customerPhone: selectedJob.customerPhone,
        customerAddress: formatAddress(selectedJob.customerAddress),
        problemDescription: 'Follow-up service after 3 months',
        serviceType: 'Service / Repair',
        technicianId: assignmentMode === 'direct' ? selectedTechnician : '',
        technicianName: techName,
        priority: 'normal',
        assignmentMode: assignmentMode,
        status: assignmentMode === 'direct' && selectedTechnician ? 'assigned' : 'pending',
        originalJobId: selectedJob.id,
        isFollowUp: true,
        createdAt: serverTimestamp(),
      }

      const jobRef = await addDoc(collection(db, 'service_jobs'), followUpJobData)

      // If broadcast mode, create notifications for all technicians
      if (assignmentMode === 'broadcast') {
        const notificationData = {
          jobId: jobRef.id,
          customerName: selectedJob.customerName,
          customerPhone: selectedJob.customerPhone,
          customerAddress: formatAddress(selectedJob.customerAddress),
          serviceType: 'Service / Repair',
          priority: 'normal',
          createdAt: serverTimestamp(),
          read: false,
          type: 'job_available'
        }

        for (const tech of technicians) {
          await addDoc(collection(db, 'users', tech.id, 'notifications'), notificationData)
        }
      }

      toast.success(assignmentMode === 'broadcast' 
        ? '✅ Follow-up service scheduled! Technicians notified.' 
        : '✅ Follow-up service assigned!'
      )
      
      // Reset form
      setSelectedJob(null)
      setAssignmentMode('broadcast')
      setSelectedTechnician('')
      
      // Navigate to service jobs page
      setTimeout(() => navigate('/admin/jobs'), 1500)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setCreating(false)
    }
  }

  const formatAddress = (addr) => {
    if (!addr) return '—'
    if (typeof addr === 'string') return addr
    return [addr.houseNo, addr.building, addr.street, addr.city, addr.state, addr.pinCode, addr.landmark]
      .filter(Boolean).join(', ')
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
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
        {/* Assignment Mode Selection */}
        <div className={`rounded-2xl p-5 border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
        }`}>
          <div className="flex gap-3">
            {[
              { 
                key: 'broadcast', 
                label: 'Broadcast to All', 
                svg: (
                  <img src={peopleImg} alt="broadcast" className="w-6 h-6 object-contain" />
                )
              },
              { 
                key: 'direct', 
                label: 'Direct Assignment', 
                svg: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )
              }
            ].map(mode => (
              <button
                key={mode.key}
                type="button"
                onClick={() => setAssignmentMode(mode.key)}
                className={`flex-1 py-4 px-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  assignmentMode === mode.key
                    ? isDark ? 'border-purple-500 bg-purple-500/20 text-purple-400' : 'border-purple-500 bg-purple-50 text-purple-700'
                    : isDark ? 'border-white/10 bg-white/5 text-white/60 hover:border-white/20' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                }`}
              >
                {mode.svg}
                <div className="font-bold text-sm text-center">{mode.label}</div>
              </button>
            ))}
          </div>

          {/* Technician Selection (if direct mode) */}
          {assignmentMode === 'direct' && (
            <div className="mt-4">
              <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                Select Technician *
              </label>
              <select
                value={selectedTechnician}
                onChange={e => setSelectedTechnician(e.target.value)}
                className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                  isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                }`}
              >
                <option value="" className="text-gray-900">Select Technician</option>
                {technicians.map(t => (
                  <option key={t.id} value={t.id} className="text-gray-900">{t.name}</option>
                ))}
              </select>
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
                        <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
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
                        <span className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                          📅 {formatDate(job.completedAt || job.createdAt)}
                        </span>
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
            className={`w-full rounded-xl py-4 text-sm font-bold text-white disabled:opacity-60 transition-all ${
              isDark
                ? 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-lg shadow-purple-500/20'
                : 'bg-gradient-to-r from-purple-500 to-purple-600 shadow-md'
            }`}
          >
            {creating ? '⏳ Creating Follow-up Service...' : '📅 Schedule Follow-up Service'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
