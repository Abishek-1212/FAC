import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import Modal from '../common/Modal'

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [itemTracking, setItemTracking] = useState({})
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [completionModal, setCompletionModal] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [trackingSaved, setTrackingSaved] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'service_jobs', jobId), snap =>
      snap.exists() && setJob({ id: snap.id, ...snap.data() })
    )
    const u2 = onSnapshot(query(collection(db, 'job_stock_assignment'), where('jobId', '==', jobId)), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAssignments(data)
      const tracking = {}
      data.forEach(a => {
        tracking[a.id] = {
          used: a.usedQuantity || 0,
          damaged: a.damagedQuantity || 0,
        }
      })
      setItemTracking(tracking)
    })
    return () => { u1(); u2() }
  }, [jobId])

  const startJob = async () => {
    setToggling(true)
    try {
      await updateDoc(doc(db, 'service_jobs', jobId), {
        status: 'in_progress',
        startedAt: serverTimestamp(),
      })
      toast.success('✅ Job started!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setToggling(false)
    }
  }

  const saveItemTracking = async () => {
    setSaving(true)
    try {
      for (const a of assignments) {
        const tracking = itemTracking[a.id] || {}
        const used = Number(tracking.used) || 0
        const damaged = Number(tracking.damaged) || 0
        const total = used + damaged

        if (total > a.assignedQuantity) {
          toast.error(`${a.productName}: Total exceeds assigned quantity (${a.assignedQuantity})`)
          setSaving(false)
          return
        }

        await updateDoc(doc(db, 'job_stock_assignment', a.id), {
          usedQuantity: used,
          damagedQuantity: damaged,
          status: 'tracked',
          lastUpdated: serverTimestamp(),
        })
      }
      setTrackingSaved(true)
      toast.success('✅ Item tracking saved! You can now complete the job.')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const completeJob = async () => {
    setSaving(true)
    try {
      // Calculate unaccounted items (to be verified by admin during return)
      const unaccounted = assignments.reduce((sum, a) => {
        const tracking = itemTracking[a.id] || {}
        const accounted = (Number(tracking.used) || 0) + (Number(tracking.damaged) || 0)
        return sum + Math.max(0, a.assignedQuantity - accounted)
      }, 0)

      // Update job status
      await updateDoc(doc(db, 'service_jobs', jobId), {
        status: 'completed',
        completedAt: serverTimestamp(),
        completionNotes,
        unaccountedItems: unaccounted,
      })

      // Create completion report
      await addDoc(collection(db, 'job_completion_reports'), {
        jobId,
        technicianId: job.technicianId,
        technicianName: job.technicianName,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        serviceType: job.serviceType,
        problemDescription: job.problemDescription,
        completionNotes,
        itemsSummary: assignments.map(a => {
          const tracking = itemTracking[a.id] || {}
          const used = Number(tracking.used) || 0
          const damaged = Number(tracking.damaged) || 0
          const unaccounted = Math.max(0, a.assignedQuantity - (used + damaged))
          return {
            productName: a.productName,
            assigned: a.assignedQuantity,
            used,
            damaged,
            unaccounted,
          }
        }),
        totalUnaccounted: unaccounted,
        completedAt: serverTimestamp(),
      })

      toast.success('✅ Job completed! Report generated.')
      setCompletionModal(false)
      setTimeout(() => navigate('/technician'), 1500)
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

  const isCompleted = job.status === 'completed'
  const isInProgress = job.status === 'in_progress'
  const canStart = ['assigned', 'pending'].includes(job.status)

  const totalAssigned = assignments.reduce((sum, a) => sum + a.assignedQuantity, 0)
  const totalUsed = Object.values(itemTracking).reduce((sum, t) => sum + (Number(t.used) || 0), 0)
  const totalDamaged = Object.values(itemTracking).reduce((sum, t) => sum + (Number(t.damaged) || 0), 0)
  const totalUnaccounted = totalAssigned - totalUsed - totalDamaged

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <button onClick={() => navigate('/technician')} className="flex items-center gap-2 text-aqua-600 text-sm font-semibold hover:text-aqua-700 transition">
        ← Back to Jobs
      </button>

      {/* Job Header Card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-br from-aqua-50 to-cyan-50 rounded-2xl p-5 shadow-sm border border-aqua-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900">{job.customerName}</h2>
            <p className="text-sm text-gray-600 mt-1">📞 {job.customerPhone}</p>
            <p className="text-sm text-gray-600">📍 {job.customerAddress}</p>
          </div>
          <span className={`text-xs font-bold px-4 py-2 rounded-full border whitespace-nowrap ${
            isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            isInProgress ? 'bg-violet-100 text-violet-700 border-violet-200' :
            'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {isCompleted ? '✅ Completed' : isInProgress ? '🔄 In Progress' : '⏳ Pending'}
          </span>
        </div>

        {job.serviceType && (
          <div className="flex gap-2 mb-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              job.serviceType === 'New Fitting' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service / Repair'}
            </span>
            {job.priority === 'urgent' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-700">🔴 Urgent</span>
            )}
          </div>
        )}

        <div className="bg-white/60 rounded-xl px-3 py-2 backdrop-blur-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Problem Description</p>
          <p className="text-sm text-gray-700 mt-1 font-medium">{job.problemDescription}</p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      {canStart && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={startJob}
          disabled={toggling}
          className="w-full bg-gradient-to-r from-violet-500 to-violet-600 text-white py-3.5 rounded-xl text-sm font-bold shadow-lg shadow-violet-200 disabled:opacity-60 hover:shadow-xl transition-all"
        >
          {toggling ? '⏳ Starting...' : '▶ Start Work'}
        </motion.button>
      )}

      {isInProgress && (
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setCompletionModal(true)}
          disabled={!trackingSaved}
          className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
            trackingSaved
              ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200 hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          ✅ Mark as Complete
        </motion.button>
      )}

      {/* Assigned Stock & Item Tracking */}
      {assignments.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50 to-cyan-50">
            <h3 className="font-bold text-gray-900">📦 Assigned Stock</h3>
            <p className="text-xs text-gray-500 mt-0.5">Track usage and damaged items</p>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-2 px-5 py-3 bg-gray-50 border-b border-gray-100">
            <div className="text-center">
              <p className="text-xs text-gray-500 font-semibold">Assigned</p>
              <p className="text-lg font-black text-gray-900">{totalAssigned}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-semibold">Used</p>
              <p className="text-lg font-black text-emerald-600">{totalUsed}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 font-semibold">Damaged</p>
              <p className="text-lg font-black text-red-600">{totalDamaged}</p>
            </div>
          </div>

          {/* Item Rows */}
          <div className="divide-y divide-gray-100">
            {assignments.map(a => {
              const tracking = itemTracking[a.id] || {}
              const accounted = (Number(tracking.used) || 0) + (Number(tracking.damaged) || 0)
              const unaccounted = Math.max(0, a.assignedQuantity - accounted)

              return (
                <div key={a.id} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{a.productName}</p>
                      <p className="text-xs text-gray-500">Assigned: <span className="font-bold">{a.assignedQuantity}</span></p>
                    </div>
                    {unaccounted > 0 && (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700">
                        Unaccounted: {unaccounted}
                      </span>
                    )}
                  </div>

                  {/* Input Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { key: 'used', label: 'Used', color: 'emerald', icon: '✓' },
                      { key: 'damaged', label: 'Damaged', color: 'red', icon: '✕' },
                    ].map(({ key, label, color, icon }) => (
                      <div key={key}>
                        <label className={`text-xs font-semibold text-${color}-600 block mb-1`}>{icon} {label}</label>
                        <input
                          type="number"
                          min={0}
                          max={a.assignedQuantity}
                          placeholder="0"
                          value={tracking[key] || ''}
                          onChange={e => setItemTracking(prev => ({
                            ...prev,
                            [a.id]: { ...tracking, [key]: e.target.value }
                          }))}
                          disabled={isCompleted || trackingSaved}
                          className={`w-full border rounded-lg px-2.5 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-${color}-300 disabled:opacity-50 disabled:bg-gray-50 ${
                            color === 'emerald' ? 'border-emerald-200 text-emerald-700' :
                            'border-red-200 text-red-700'
                          }`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {!isCompleted && !trackingSaved && (
            <div className="px-5 py-4 border-t border-gray-100 bg-gray-50">
              <button
                onClick={saveItemTracking}
                disabled={saving}
                className="w-full bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 hover:bg-aqua-600 transition"
              >
                {saving ? '💾 Saving...' : '💾 Save Item Tracking'}
              </button>
            </div>
          )}

          {trackingSaved && (
            <div className="px-5 py-4 border-t border-gray-100 bg-emerald-50">
              <p className="text-sm font-bold text-emerald-700 text-center">✅ Item tracking saved</p>
            </div>
          )}
        </motion.div>
      )}

      {assignments.length === 0 && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-2">📦</p>
          <p className="text-gray-500 text-sm font-medium">No stock assigned to this job yet</p>
          <p className="text-gray-400 text-xs mt-1">Admin will assign stock before you start work</p>
        </div>
      )}

      {/* Completion Modal */}
      <Modal open={completionModal} onClose={() => setCompletionModal(false)} title="Complete Job" size="lg">
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
            <p className="text-sm font-bold text-emerald-900">✅ Ready to complete this job?</p>
            <p className="text-xs text-emerald-700 mt-1">A completion report will be generated automatically.</p>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Item Summary</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-gray-600">Total Assigned:</span> <span className="font-bold">{totalAssigned}</span></div>
              <div><span className="text-gray-600">Total Used:</span> <span className="font-bold text-emerald-600">{totalUsed}</span></div>
              <div><span className="text-gray-600">Total Damaged:</span> <span className="font-bold text-red-600">{totalDamaged}</span></div>
              {totalUnaccounted > 0 && (
                <div className="col-span-2"><span className="text-gray-600">Unaccounted Items:</span> <span className="font-bold text-amber-600">{totalUnaccounted}</span></div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-gray-600 uppercase tracking-wider block mb-2">Completion Notes (Optional)</label>
            <textarea
              value={completionNotes}
              onChange={e => setCompletionNotes(e.target.value)}
              placeholder="Add any notes about the job completion, issues encountered, etc."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setCompletionModal(false)}
              className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-bold hover:bg-gray-200 transition"
            >
              Cancel
            </button>
            <button
              onClick={completeJob}
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg shadow-emerald-200 disabled:opacity-60 hover:shadow-xl transition-all"
            >
              {saving ? '⏳ Completing...' : '✅ Complete Job'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
