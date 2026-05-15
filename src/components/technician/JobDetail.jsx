import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate  = useNavigate()
  const [job, setJob]             = useState(null)
  const [assignments, setAssignments] = useState([])
  const [usageMap, setUsageMap]   = useState({})
  const [saving, setSaving]       = useState(false)
  const [toggling, setToggling]   = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'service_jobs', jobId), snap =>
      snap.exists() && setJob({ id: snap.id, ...snap.data() })
    )
    const u2 = onSnapshot(query(collection(db, 'job_stock_assignment'), where('jobId', '==', jobId)), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAssignments(data)
      const map = {}
      data.forEach(a => { map[a.id] = String(a.usedQuantity || 0) })
      setUsageMap(map)
    })
    return () => { u1(); u2() }
  }, [jobId])

  const toggleStatus = async () => {
    if (!job) return
    const newStatus = job.status === 'completed' ? 'in_progress' : 'completed'
    setToggling(true)
    try {
      await updateDoc(doc(db, 'service_jobs', jobId), {
        status: newStatus,
        ...(newStatus === 'completed' ? { completedAt: serverTimestamp() } : { completedAt: null }),
      })
      toast.success(newStatus === 'completed' ? '✅ Marked as completed!' : '🔄 Marked as in progress')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setToggling(false)
    }
  }

  const startJob = async () => {
    setToggling(true)
    try {
      await updateDoc(doc(db, 'service_jobs', jobId), { status: 'in_progress', startedAt: serverTimestamp() })
      toast.success('Job started!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setToggling(false)
    }
  }

  const saveUsage = async () => {
    setSaving(true)
    try {
      for (const a of assignments) {
        await updateDoc(doc(db, 'job_stock_assignment', a.id), { usedQuantity: Number(usageMap[a.id] || 0) })
      }
      toast.success('Usage saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!job) return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-4 border-aqua-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const isCompleted  = job.status === 'completed'
  const isInProgress = job.status === 'in_progress'
  const canStart     = ['assigned', 'pending'].includes(job.status)

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <button onClick={() => navigate('/technician')} className="flex items-center gap-2 text-aqua-600 text-sm font-semibold hover:text-aqua-700 transition">
        ← Back to Jobs
      </button>

      {/* Job card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-900">{job.customerName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">📞 {job.customerPhone}</p>
            <p className="text-sm text-gray-500">📍 {job.customerAddress}</p>
            {job.serviceType && (
              <span className={`mt-2 inline-block text-xs font-bold px-3 py-1 rounded-full ${
                job.serviceType === 'New Fitting' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
              }`}>
                {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service / Repair'}
              </span>
            )}
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
            isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            isInProgress ? 'bg-violet-100 text-violet-700 border-violet-200' :
            'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {job.status?.replace('_', ' ')}
          </span>
        </div>

        {job.componentName && (
          <div className="bg-aqua-50 rounded-xl px-3 py-2 mb-3">
            <p className="text-xs text-aqua-500 font-semibold">Component</p>
            <p className="text-sm font-bold text-aqua-800">🔩 {job.componentName}</p>
          </div>
        )}

        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Problem</p>
          <p className="text-sm text-gray-700 mt-1">{job.problemDescription}</p>
        </div>
      </motion.div>

      {/* Status control */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Job Status</p>

        {canStart && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={startJob}
            disabled={toggling}
            className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white py-3 rounded-xl text-sm font-bold shadow-md shadow-violet-200 disabled:opacity-60"
          >
            {toggling ? 'Starting...' : '▶ Start Job'}
          </motion.button>
        )}

        {(isInProgress || isCompleted) && (
          <div className="space-y-3">
            {/* Toggle switch */}
            <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
              <div>
                <p className="font-bold text-gray-800 text-sm">
                  {isCompleted ? '✅ Job Completed' : '🔄 In Progress'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isCompleted ? 'Admin has been notified' : 'Tap to mark as completed'}
                </p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={toggleStatus}
                disabled={toggling}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-60 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-gray-300'
                }`}
              >
                <motion.div
                  animate={{ x: isCompleted ? 28 : 4 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="absolute top-1 w-5 h-5 bg-white rounded-full shadow-md"
                />
              </motion.button>
            </div>

            {/* Explicit buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => !isInProgress && toggleStatus()}
                disabled={toggling || isInProgress}
                className={`py-2.5 rounded-xl text-sm font-bold transition ${
                  isInProgress
                    ? 'bg-violet-500 text-white shadow-md shadow-violet-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-violet-50'
                }`}
              >
                🔄 In Progress
              </button>
              <button
                onClick={() => !isCompleted && toggleStatus()}
                disabled={toggling || isCompleted}
                className={`py-2.5 rounded-xl text-sm font-bold transition ${
                  isCompleted
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-gray-100 text-gray-500 hover:bg-emerald-50'
                }`}
              >
                ✅ Completed
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Assigned Stock */}
      {assignments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Assigned Stock</h3>
            <p className="text-xs text-gray-400 mt-0.5">Enter how many units you used</p>
          </div>
          <div className="divide-y divide-gray-50">
            {assignments.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{a.productName}</p>
                  <p className="text-xs text-gray-400">Assigned: {a.assignedQuantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400">Used:</label>
                  <input
                    type="number" min={0} max={a.assignedQuantity}
                    value={usageMap[a.id] || '0'}
                    onChange={e => setUsageMap(m => ({ ...m, [a.id]: e.target.value }))}
                    className="w-16 border border-gray-200 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-aqua-300"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={saveUsage} disabled={saving} className="w-full bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 hover:bg-aqua-600 transition">
              {saving ? 'Saving...' : 'Save Usage'}
            </button>
          </div>
        </motion.div>
      )}

      {assignments.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">No stock assigned to this job yet</p>
        </div>
      )}
    </div>
  )
}
