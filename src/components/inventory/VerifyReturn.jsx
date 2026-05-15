import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc, addDoc, getDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'

export default function VerifyReturn() {
  const [assignments, setAssignments] = useState([])
  const [returning, setReturning] = useState(null)
  const [returnQty, setReturnQty] = useState('')
  const [usedQty, setUsedQty] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(query(collection(db, 'job_stock_assignment'), where('status', '==', 'assigned')), snap => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [])

  const handleVerify = async () => {
    if (!returning) return
    setSaving(true)
    try {
      const used = Number(usedQty)
      const returned = Number(returnQty)
      const missing = returning.assignedQuantity - used - returned

      await updateDoc(doc(db, 'job_stock_assignment', returning.id), {
        usedQuantity: used,
        returnedQuantity: returned,
        status: 'verified',
      })

      // Add returned stock back to inventory
      if (returned > 0) {
        const invRef = doc(db, 'inventory', returning.productId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) {
          await updateDoc(invRef, { quantity: (invSnap.data().quantity || 0) + returned, lastUpdated: serverTimestamp() })
        }

        await addDoc(collection(db, 'stock_transactions'), {
          type: 'return',
          productId: returning.productId,
          productName: returning.productName,
          quantity: returned,
          fromUser: returning.technicianName,
          jobId: returning.jobId,
          timestamp: serverTimestamp(),
        })
      }

      if (missing > 0) {
        toast.error(`⚠️ ${missing} units of ${returning.productName} are missing from ${returning.technicianName}!`)
      } else {
        toast.success('Return verified successfully')
      }

      setReturning(null)
      setReturnQty('')
      setUsedQty('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <h2 className="text-xl font-black text-gray-800">Verify Returns</h2>
      <p className="text-sm text-gray-500">Verify stock returned by technicians</p>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">✅</p>
          <p className="text-gray-500 text-sm">No pending returns to verify</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assignments.map(a => (
            <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-800">{a.productName}</p>
                  <p className="text-xs text-gray-500">👷 {a.technicianName}</p>
                  <p className="text-sm text-gray-600 mt-1">Assigned: <span className="font-bold">{a.assignedQuantity}</span> units</p>
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-semibold">Pending</span>
              </div>

              {returning?.id === a.id ? (
                <div className="space-y-3 border-t border-gray-100 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Units Used</label>
                      <input type="number" min={0} max={a.assignedQuantity} value={usedQty} onChange={e => setUsedQty(e.target.value)} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-500">Units Returned</label>
                      <input type="number" min={0} max={a.assignedQuantity} value={returnQty} onChange={e => setReturnQty(e.target.value)} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
                    </div>
                  </div>
                  {usedQty && returnQty && (
                    <p className={`text-xs font-semibold ${a.assignedQuantity - Number(usedQty) - Number(returnQty) > 0 ? 'text-red-500' : 'text-green-600'}`}>
                      {a.assignedQuantity - Number(usedQty) - Number(returnQty) > 0
                        ? `⚠️ ${a.assignedQuantity - Number(usedQty) - Number(returnQty)} units missing!`
                        : '✅ All units accounted for'}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setReturning(null)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-600">Cancel</button>
                    <button onClick={handleVerify} disabled={saving || !usedQty || !returnQty} className="flex-1 bg-aqua-500 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-60">
                      {saving ? 'Verifying...' : 'Verify'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => { setReturning(a); setUsedQty(''); setReturnQty('') }} className="w-full bg-aqua-50 text-aqua-700 rounded-xl py-2 text-sm font-semibold hover:bg-aqua-100 transition">
                  Verify Return
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
