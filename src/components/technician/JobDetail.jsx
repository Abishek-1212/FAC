import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp, addDoc, getDocs, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'
import Modal from '../common/Modal'
import InvoiceModal from '../common/InvoiceModal'

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const [job, setJob] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [itemTracking, setItemTracking] = useState({})
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [completionModal, setCompletionModal] = useState(false)
  const [completionNotes, setCompletionNotes] = useState('')
  const [trackingSaved, setTrackingSaved] = useState(false)
  const [technicianStock, setTechnicianStock] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showInvoicePrompt, setShowInvoicePrompt] = useState(false)
  const [completedJobData, setCompletedJobData] = useState(null)
  const [invoiceModal, setInvoiceModal] = useState(false)



  // Load job data
  useEffect(() => {
    if (!jobId) {
      navigate('/technician')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const unsubscribe = onSnapshot(
        doc(db, 'service_jobs', jobId), 
        (snap) => {
          if (snap.exists()) {
            setJob({ id: snap.id, ...snap.data() })
            setLoading(false)
          } else {
            setError('Job not found')
            setLoading(false)
            toast.error('Job not found')
            setTimeout(() => navigate('/technician'), 2000)
          }
        },
        (err) => {
          console.error('Firestore error:', err)
          setError(err.message)
          setLoading(false)
          toast.error('Error loading job')
          setTimeout(() => navigate('/technician'), 2000)
        }
      )
      return unsubscribe
    } catch (err) {
      console.error('Setup error:', err)
      setError(err.message)
      setLoading(false)
    }
  }, [jobId, navigate])

  // Load job stock assignments
  useEffect(() => {
    if (!jobId) return
    const unsubscribe = onSnapshot(
      query(collection(db, 'job_stock_assignment'), where('jobId', '==', jobId)),
      snap => setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return unsubscribe
  }, [jobId])

  useEffect(() => {
    if (!job?.technicianId) return
    const u3 = onSnapshot(
      query(collection(db, 'technician_stock'), where('technicianId', '==', job.technicianId), where('status', '==', 'active')),
      snap => setTechnicianStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return u3
  }, [job?.technicianId])

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

        // Update job stock assignment
        await updateDoc(doc(db, 'job_stock_assignment', a.id), {
          usedQuantity: used,
          damagedQuantity: damaged,
          status: 'tracked',
          lastUpdated: serverTimestamp(),
        })

        // Update technician stock
        const techStockQuery = query(
          collection(db, 'technician_stock'),
          where('technicianId', '==', job.technicianId),
          where('productId', '==', a.productId),
          where('status', '==', 'active')
        )
        const techStockSnap = await getDocs(techStockQuery)
        
        if (!techStockSnap.empty) {
          const techStockDoc = techStockSnap.docs[0]
          const currentUsed = techStockDoc.data().usedQuantity || 0
          const currentDamaged = techStockDoc.data().damagedQuantity || 0
          
          await updateDoc(doc(db, 'technician_stock', techStockDoc.id), {
            usedQuantity: currentUsed + used,
            damagedQuantity: currentDamaged + damaged,
            lastUpdated: serverTimestamp(),
          })
        }

        // Auto-deduct from inventory
        const invRef = doc(db, 'inventory', a.productId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) {
          const currentQty = invSnap.data().quantity || 0
          await updateDoc(invRef, {
            quantity: Math.max(0, currentQty - total),
            lastUpdated: serverTimestamp(),
          })
        }
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
        usedPersonalStock: !hasAssignedStock,
      })

      // Create completion report
      const reportData = {
        jobId,
        technicianId: job.technicianId,
        technicianName: job.technicianName,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        customerAddress: job.customerAddress,
        serviceType: job.serviceType,
        problemDescription: job.problemDescription,
        completionNotes,
        completedAt: serverTimestamp(),
        usedPersonalStock: !hasAssignedStock,
      }

      // Add admin-assigned stock summary if exists
      if (hasAssignedStock) {
        reportData.itemsSummary = assignments.map(a => {
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
        })
        reportData.totalUnaccounted = unaccounted
      }

      await addDoc(collection(db, 'job_completion_reports'), reportData)

      toast.success('✅ Job completed! Report generated.')
      setCompletionModal(false)
      
      // Store completed job data and show invoice prompt
      setCompletedJobData({
        id: jobId,
        customerName: job.customerName || 'N/A',
        customerPhone: job.customerPhone || 'N/A',
        customerAddress: job.customerAddress || 'N/A',
        serviceType: job.serviceType || 'N/A',
        completedAt: new Date(),
        problemDescription: job.problemDescription || 'N/A',
        technicianId: user.uid,
        technicianName: profile?.name || 'Technician',
      })
      setShowInvoicePrompt(true)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="w-12 h-12 border-4 border-aqua-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-gray-500 text-sm">Loading job details...</p>
    </div>
  )

  if (error) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-4xl mb-4">⚠️</p>
      <p className="text-red-600 text-sm font-semibold">{error}</p>
      <button 
        onClick={() => navigate('/technician')} 
        className="mt-4 px-4 py-2 bg-aqua-500 text-white rounded-lg text-sm font-bold"
      >
        Back to Jobs
      </button>
    </div>
  )

  if (!job) return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <p className="text-4xl mb-4">📋</p>
      <p className="text-gray-500 text-sm">Job not found</p>
      <button 
        onClick={() => navigate('/technician')} 
        className="mt-4 px-4 py-2 bg-aqua-500 text-white rounded-lg text-sm font-bold"
      >
        Back to Jobs
      </button>
    </div>
  )

  const isCompleted = job.status === 'completed'
  const isInProgress = job.status === 'in_progress'
  const canStart = ['assigned', 'pending'].includes(job.status)
  const hasAssignedStock = assignments.length > 0

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
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-black text-gray-900 mb-3">{job.customerName}</h2>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span className="font-medium">{job.customerPhone}</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-gray-700">
                <svg className="w-4 h-4 flex-shrink-0 text-gray-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-medium flex-1">{job.customerAddress}</span>
              </div>
            </div>
          </div>
          <span className={`text-xs font-bold px-4 py-2 rounded-lg border whitespace-nowrap flex items-center gap-1.5 flex-shrink-0 ml-3 ${
            isCompleted ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
            isInProgress ? 'bg-violet-100 text-violet-700 border-violet-200' :
            'bg-amber-100 text-amber-700 border-amber-200'
          }`}>
            {isCompleted ? (
              <>
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>Completed</span>
              </>
            ) : isInProgress ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>In Progress</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Pending</span>
              </>
            )}
          </span>
        </div>

        {job.serviceType && (
          <div className="flex gap-2 mb-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 ${
              job.serviceType === 'New Fitting' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
            }`}>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>{job.serviceType}</span>
            </span>
            {job.priority === 'urgent' && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-100 text-red-700 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>Urgent</span>
              </span>
            )}
          </div>
        )}

        <div className="bg-white/60 rounded-xl px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider mb-1.5">Problem Description</p>
          <p className="text-sm text-gray-700 font-medium leading-relaxed">{job.problemDescription}</p>
        </div>
      </motion.div>

      {/* Action Buttons */}
      {canStart && (
        <div className="space-y-3">
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
        </div>
      )}

      {isInProgress && (
        <div className="space-y-3">
          {hasAssignedStock && !trackingSaved && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs font-bold text-blue-700">💡 Track your stock usage below</p>
              <p className="text-xs text-blue-600 mt-1">Save item tracking before completing the job</p>
            </div>
          )}
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setCompletionModal(true)}
            disabled={hasAssignedStock && !trackingSaved}
            className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all ${
              (!hasAssignedStock || trackingSaved)
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-emerald-200 hover:shadow-xl'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            ✅ Mark as Complete
          </motion.button>
        </div>
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


      
      {assignments.length === 0 && !isInProgress && !isCompleted && (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-2">📦</p>
          <p className="text-gray-500 text-sm font-medium">No stock assigned to this job yet</p>
          <p className="text-gray-400 text-xs mt-1">You can start work using your personal stock or wait for admin to assign stock</p>
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
          {hasAssignedStock && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Admin-Assigned Stock Summary</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-600">Total Assigned:</span> <span className="font-bold">{totalAssigned}</span></div>
                <div><span className="text-gray-600">Total Used:</span> <span className="font-bold text-emerald-600">{totalUsed}</span></div>
                <div><span className="text-gray-600">Total Damaged:</span> <span className="font-bold text-red-600">{totalDamaged}</span></div>
                {totalUnaccounted > 0 && (
                  <div className="col-span-2"><span className="text-gray-600">Unaccounted Items:</span> <span className="font-bold text-amber-600">{totalUnaccounted}</span></div>
                )}
              </div>
            </div>
          )}

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

      {/* Invoice Prompt Modal */}
      <Modal 
        open={showInvoicePrompt} 
        onClose={() => {
          setShowInvoicePrompt(false)
          navigate('/technician')
        }} 
        title="Job Completed Successfully!" 
        size="md"
      >
        <div className="space-y-4">
          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-center">
            <p className="text-4xl mb-2">✅</p>
            <p className="text-lg font-bold text-emerald-900">Job Completed!</p>
            <p className="text-sm text-emerald-700 mt-1">Completion report has been generated.</p>
          </div>

          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <p className="text-sm font-bold text-blue-900 mb-2">📄 Generate Invoice</p>
            <p className="text-xs text-blue-700">Would you like to generate an invoice for this job now?</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowInvoicePrompt(false)
                navigate('/technician')
              }}
              className="flex-1 bg-gray-100 text-gray-700 rounded-xl py-2.5 text-sm font-bold hover:bg-gray-200 transition"
            >
              Skip for Now
            </button>
            <button
              onClick={() => {
                setShowInvoicePrompt(false)
                setInvoiceModal(true)
              }}
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl py-2.5 text-sm font-bold shadow-lg shadow-blue-200 hover:shadow-xl transition-all"
            >
              Generate Invoice
            </button>
          </div>
        </div>
      </Modal>

      {/* Invoice Modal */}
      {completedJobData && (
        <InvoiceModal
          open={invoiceModal}
          onClose={() => {
            setInvoiceModal(false)
            navigate('/technician')
          }}
          job={completedJobData}
          isDark={false}
        />
      )}
    </div>
  )
}
