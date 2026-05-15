import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'

export default function MyStock() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState([])

  useEffect(() => {
    if (!user) return
    return onSnapshot(query(collection(db, 'job_stock_assignment'), where('technicianId', '==', user.uid), where('status', '==', 'assigned')), snap => {
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
  }, [user])

  const totalAssigned = assignments.reduce((s, a) => s + (a.assignedQuantity || 0), 0)
  const totalUsed = assignments.reduce((s, a) => s + (a.usedQuantity || 0), 0)

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div>
        <h2 className="text-xl font-black text-gray-800">My Stock</h2>
        <p className="text-sm text-gray-500">Products currently assigned to you</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-black text-aqua-600">{totalAssigned}</p>
          <p className="text-sm text-gray-500">Total Assigned</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <p className="text-2xl font-black text-green-600">{totalUsed}</p>
          <p className="text-sm text-gray-500">Total Used</p>
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">📦</p>
          <p className="text-gray-500 text-sm">No stock assigned to you currently</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assignments.map(a => {
            const remaining = a.assignedQuantity - a.usedQuantity - a.returnedQuantity
            return (
              <div key={a.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="font-bold text-gray-800">{a.productName}</p>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-blue-50 rounded-xl p-2">
                    <p className="text-lg font-black text-blue-600">{a.assignedQuantity}</p>
                    <p className="text-xs text-gray-500">Assigned</p>
                  </div>
                  <div className="bg-green-50 rounded-xl p-2">
                    <p className="text-lg font-black text-green-600">{a.usedQuantity}</p>
                    <p className="text-xs text-gray-500">Used</p>
                  </div>
                  <div className={`rounded-xl p-2 ${remaining > 0 ? 'bg-yellow-50' : 'bg-gray-50'}`}>
                    <p className={`text-lg font-black ${remaining > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>{remaining}</p>
                    <p className="text-xs text-gray-500">Remaining</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
