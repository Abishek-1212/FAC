import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import StatCard from '../common/StatCard'

export default function Reports() {
  const [data, setData] = useState({ jobs: [], invoices: [], assignments: [], inventory: [] })

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), s => setData(d => ({ ...d, jobs: s.docs.map(x => x.data()) })))
    const u2 = onSnapshot(collection(db, 'invoices'), s => setData(d => ({ ...d, invoices: s.docs.map(x => x.data()) })))
    const u3 = onSnapshot(collection(db, 'job_stock_assignment'), s => setData(d => ({ ...d, assignments: s.docs.map(x => x.data()) })))
    const u4 = onSnapshot(collection(db, 'inventory'), s => setData(d => ({ ...d, inventory: s.docs.map(x => ({ id: x.id, ...x.data() })) })))
    return () => { u1(); u2(); u3(); u4() }
  }, [])

  const totalRevenue = data.invoices.reduce((s, i) => s + (i.totalAmount || 0), 0)
  const paidRevenue = data.invoices.filter(i => i.paymentStatus === 'paid').reduce((s, i) => s + (i.totalAmount || 0), 0)
  const completedJobs = data.jobs.filter(j => j.status === 'completed').length
  const totalAssigned = data.assignments.reduce((s, a) => s + (a.assignedQuantity || 0), 0)
  const totalReturned = data.assignments.reduce((s, a) => s + (a.returnedQuantity || 0), 0)
  const totalUsed = data.assignments.reduce((s, a) => s + (a.usedQuantity || 0), 0)
  const missing = totalAssigned - totalUsed - totalReturned

  // Technician performance
  const techMap = {}
  data.assignments.forEach(a => {
    if (!a.technicianName) return
    if (!techMap[a.technicianName]) techMap[a.technicianName] = { assigned: 0, used: 0, returned: 0 }
    techMap[a.technicianName].assigned += a.assignedQuantity || 0
    techMap[a.technicianName].used += a.usedQuantity || 0
    techMap[a.technicianName].returned += a.returnedQuantity || 0
  })

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <h2 className="text-xl font-black text-gray-800">Reports & Analytics</h2>

      <div>
        <p className="text-sm font-bold text-gray-600 mb-3">Revenue</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="💰" label="Total Revenue" value={`₹${totalRevenue.toLocaleString('en-IN')}`} color="green" />
          <StatCard icon="✅" label="Collected" value={`₹${paidRevenue.toLocaleString('en-IN')}`} color="aqua" />
          <StatCard icon="⏳" label="Pending" value={`₹${(totalRevenue - paidRevenue).toLocaleString('en-IN')}`} color="yellow" />
          <StatCard icon="🔧" label="Jobs Done" value={completedJobs} color="blue" />
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-gray-600 mb-3">Stock Summary</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon="📤" label="Total Assigned" value={totalAssigned} color="blue" />
          <StatCard icon="🔨" label="Used" value={totalUsed} color="aqua" />
          <StatCard icon="↩️" label="Returned" value={totalReturned} color="green" />
          <StatCard icon="⚠️" label="Missing" value={missing > 0 ? missing : 0} color={missing > 0 ? 'red' : 'green'} />
        </div>
      </div>

      {Object.keys(techMap).length > 0 && (
        <div>
          <p className="text-sm font-bold text-gray-600 mb-3">Technician Performance</p>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Technician</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Assigned</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Used</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500">Missing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {Object.entries(techMap).map(([name, s]) => {
                  const miss = s.assigned - s.used - s.returned
                  return (
                    <tr key={name}>
                      <td className="px-4 py-3 font-medium">{name}</td>
                      <td className="text-center px-3 py-3">{s.assigned}</td>
                      <td className="text-center px-3 py-3">{s.used}</td>
                      <td className={`text-center px-3 py-3 font-bold ${miss > 0 ? 'text-red-500' : 'text-green-500'}`}>{miss > 0 ? miss : '✓'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <p className="text-sm font-bold text-gray-600 mb-3">Current Inventory</p>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {data.inventory.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-8">No inventory data</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.inventory.map(item => (
                <div key={item.id} className="px-4 py-3 flex items-center justify-between">
                  <p className="font-medium text-sm">{item.productName || item.productId}</p>
                  <span className={`font-black text-sm ${item.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>{item.quantity} units</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
