import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc, addDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'

export default function VerifyReturn() {
  const { isDark } = useTheme()
  const [completedJobs, setCompletedJobs] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [verificationModal, setVerificationModal] = useState(false)
  const [verificationData, setVerificationData] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(
      query(collection(db, 'service_jobs'), where('status', '==', 'completed')),
      snap => {
        setCompletedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)))
      }
    )
  }, [])

  const getJobAssignments = async (jobId) => {
    const snap = await collection(db, 'job_stock_assignment')
    const q = query(snap, where('jobId', '==', jobId))
    return new Promise((resolve) => {
      onSnapshot(q, (snapshot) => {
        resolve(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
      })
    })
  }

  const handleVerifyJob = async (job) => {
    const assignments = await getJobAssignments(job.id)
    setSelectedJob({ ...job, assignments })
    
    const verification = {}
    assignments.forEach(a => {
      const unaccounted = Math.max(0, a.assignedQuantity - (a.usedQuantity || 0) - (a.damagedQuantity || 0))
      verification[a.id] = {
        returned: unaccounted,
        damaged: 0,
      }
    })
    setVerificationData(verification)
    setVerificationModal(true)
  }

  const handleVerifyReturn = async () => {
    if (!selectedJob) return
    setSaving(true)
    try {
      for (const assignment of selectedJob.assignments) {
        const verification = verificationData[assignment.id] || {}
        const returned = Number(verification.returned) || 0
        const damaged = Number(verification.damaged) || 0
        const total = returned + damaged

        if (total > (selectedJob.unaccountedItems || 0)) {
          toast.error(`Verification total exceeds unaccounted items`)
          setSaving(false)
          return
        }

        // Update assignment with verified return
        await updateDoc(doc(db, 'job_stock_assignment', assignment.id), {
          returnedQuantity: returned,
          damagedQuantity: (assignment.damagedQuantity || 0) + damaged,
          status: 'verified',
          verifiedAt: serverTimestamp(),
        })

        // Add returned stock back to inventory
        if (returned > 0) {
          const invRef = doc(db, 'inventory', assignment.productId)
          const invSnap = await getDoc(invRef)
          if (invSnap.exists()) {
            await updateDoc(invRef, {
              quantity: (invSnap.data().quantity || 0) + returned,
              lastUpdated: serverTimestamp(),
            })
          }

          await addDoc(collection(db, 'stock_transactions'), {
            type: 'return_verified',
            productId: assignment.productId,
            productName: assignment.productName,
            quantity: returned,
            fromUser: selectedJob.technicianName,
            jobId: selectedJob.id,
            timestamp: serverTimestamp(),
          })
        }

        // Log damaged items
        if (damaged > 0) {
          await addDoc(collection(db, 'stock_transactions'), {
            type: 'damaged',
            productId: assignment.productId,
            productName: assignment.productName,
            quantity: damaged,
            fromUser: selectedJob.technicianName,
            jobId: selectedJob.id,
            timestamp: serverTimestamp(),
          })
        }
      }

      // Update job status to verified
      await updateDoc(doc(db, 'service_jobs', selectedJob.id), {
        status: 'verified',
        verifiedAt: serverTimestamp(),
      })

      toast.success('✅ Return verified successfully')
      setVerificationModal(false)
      setSelectedJob(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Verify Returns</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Verify stock returned by technicians for completed jobs</p>
      </div>

      {/* Completed Jobs List */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3">
          {completedJobs.map((job, i) => (
            <motion.div
              key={job.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl p-4 shadow-sm border ${
                isDark
                  ? 'bg-dark-card border-white/10'
                  : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {job.customerName}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    👷 {job.technicianName}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    📅 {formatDate(job.completedAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                  }`}>
                    ✅ Completed
                  </span>
                  {job.unaccountedItems > 0 && (
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-600'
                    }`}>
                      ⚠️ {job.unaccountedItems} Items
                    </span>
                  )}
                </div>
              </div>

              {job.unaccountedItems > 0 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleVerifyJob(job)}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold transition ${
                    isDark
                      ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                      : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                  }`}
                >
                  Verify Return
                </motion.button>
              ) : (
                <div className={`w-full py-2.5 rounded-xl text-sm font-bold text-center ${
                  isDark
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-emerald-100 text-emerald-700'
                }`}>
                  ✅ All Items Accounted
                </div>
              )}
            </motion.div>
          ))}

          {completedJobs.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-2xl p-12 text-center border border-dashed ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              <p className="text-4xl mb-3">✅</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                No completed jobs to verify
              </p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

      {/* Verification Modal */}
      <Modal open={verificationModal} onClose={() => setVerificationModal(false)} title="Verify Return" size="lg">
        {selectedJob && (
          <div className="space-y-4">
            {/* Job Info */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Job Details</p>
              <div className="mt-2 space-y-1">
                <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="font-semibold">Customer:</span> {selectedJob.customerName}
                </p>
                <p className={`text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  <span className="font-semibold">Technician:</span> {selectedJob.technicianName}
                </p>
              </div>
            </div>

            {/* Items to Verify */}
            <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
              <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Items to Verify</p>
              <div className="mt-3 space-y-3">
                {selectedJob.assignments?.map(a => {
                  const verification = verificationData[a.id] || {}
                  const unaccounted = Math.max(0, a.assignedQuantity - (a.usedQuantity || 0) - (a.damagedQuantity || 0))

                  return (
                    <div key={a.id} className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                      <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {a.productName}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                        Unaccounted: <span className="font-bold">{unaccounted}</span>
                      </p>

                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                            ↩ Returned
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={unaccounted}
                            value={verification.returned || 0}
                            onChange={e => setVerificationData(prev => ({
                              ...prev,
                              [a.id]: { ...verification, returned: e.target.value }
                            }))}
                            className={`w-full border rounded-lg px-2.5 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                              isDark ? 'bg-white/5 border-blue-500/30 text-blue-300' : 'border-blue-200 text-blue-700'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                            ✕ Damaged
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={unaccounted}
                            value={verification.damaged || 0}
                            onChange={e => setVerificationData(prev => ({
                              ...prev,
                              [a.id]: { ...verification, damaged: e.target.value }
                            }))}
                            className={`w-full border rounded-lg px-2.5 py-2 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 ${
                              isDark ? 'bg-white/5 border-red-500/30 text-red-300' : 'border-red-200 text-red-700'
                            }`}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setVerificationModal(false)}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                  isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyReturn}
                disabled={saving}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${
                  isDark
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-lg shadow-emerald-500/20'
                    : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                }`}
              >
                {saving ? '⏳ Verifying...' : '✅ Verify Return'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
