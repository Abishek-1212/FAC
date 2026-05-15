import { useEffect, useState } from 'react'
import { doc, onSnapshot, updateDoc, collection, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
}

export default function JobDetail() {
  const { jobId } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [usageMap, setUsageMap] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(doc(db, 'service_jobs', jobId), snap => snap.exists() && setJob({ id: snap.id, ...snap.data() }))
    const u2 = onSnapshot(query(collection(db, 'job_stock_assignment'), where('jobId', '==', jobId)), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setAssignments(data)
      const map = {}
      data.forEach(a => { map[a.id] = String(a.usedQuantity || 0) })
      setUsageMap(map)
    })
    return () => { u1(); u2() }
  }, [jobId])

  const updateStatus = async (status) => {
    await updateDoc(doc(db, 'service_jobs', jobId), { status, ...(status === 'in_progress' ? { startedAt: serverTimestamp() } : {}), ...(status === 'completed' ? { completedAt: serverTimestamp() } : {}) })
    toast.success(`Status: ${status.replace('_', ' ')}`)
  }

  const saveUsage = async () => {
    setSaving(true)
    try {
      for (const a of assignments) {
        const used = Number(usageMap[a.id] || 0)
        await updateDoc(doc(db, 'job_stock_assignment', a.id), { usedQuantity: used })
      }
      toast.success('Usage saved')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!job) return <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-aqua-500 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <button onClick={() => navigate('/technician')} className="flex items-center gap-2 text-aqua-600 text-sm font-semibold">
        ← Back to Jobs
      </button>

      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-black text-gray-800">{job.customerName}</h2>
            <p className="text-sm text-gray-500 mt-0.5">📞 {job.customerPhone}</p>
            <p className="text-sm text-gray-500">📍 {job.customerAddress}</p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-600'}`}>
            {job.status?.replace('_', ' ')}
          </span>
        </div>
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Problem</p>
          <p className="text-sm text-gray-700 mt-1">{job.problemDescription}</p>
        </div>
      </div>

      {/* Status Actions */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Update Status</p>
        <div className="flex gap-2 flex-wrap">
          {job.status !== 'in_progress' && job.status !== 'completed' && (
            <button onClick={() => updateStatus('in_progress')} className="bg-purple-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
              ▶ Start Job
            </button>
          )}
          {job.status === 'in_progress' && (
            <button onClick={() => updateStatus('completed')} className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-bold">
              ✅ Mark Complete
            </button>
          )}
        </div>
      </div>

      {/* Assigned Stock */}
      {assignments.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800">Assigned Stock</h3>
            <p className="text-xs text-gray-500 mt-0.5">Enter how many units you actually used</p>
          </div>
          <div className="divide-y divide-gray-50">
            {assignments.map(a => (
              <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{a.productName}</p>
                  <p className="text-xs text-gray-500">Assigned: {a.assignedQuantity}</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Used:</label>
                  <input
                    type="number"
                    min={0}
                    max={a.assignedQuantity}
                    value={usageMap[a.id] || '0'}
                    onChange={e => setUsageMap(m => ({ ...m, [a.id]: e.target.value }))}
                    className="w-16 border border-gray-200 rounded-xl px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-aqua-300"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-4 border-t border-gray-100">
            <button onClick={saveUsage} disabled={saving} className="w-full bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Usage'}
            </button>
          </div>
        </div>
      )}

      {assignments.length === 0 && (
        <div className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100">
          <p className="text-gray-400 text-sm">No stock assigned to this job yet</p>
        </div>
      )}
    </div>
  )
}
