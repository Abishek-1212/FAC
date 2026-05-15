import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import StatCard from '../common/StatCard'
import { motion } from 'framer-motion'

export default function AdminHome() {
  const [stats, setStats] = useState({ jobs: 0, pending: 0, products: 0, technicians: 0, revenue: 0, missing: 0 })

  useEffect(() => {
    const unsubs = []

    unsubs.push(onSnapshot(collection(db, 'service_jobs'), snap => {
      const pending = snap.docs.filter(d => ['pending', 'assigned'].includes(d.data().status)).length
      setStats(s => ({ ...s, jobs: snap.size, pending }))
    }))

    unsubs.push(onSnapshot(collection(db, 'products'), snap => {
      setStats(s => ({ ...s, products: snap.size }))
    }))

    unsubs.push(onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap => {
      setStats(s => ({ ...s, technicians: snap.size }))
    }))

    unsubs.push(onSnapshot(collection(db, 'invoices'), snap => {
      const revenue = snap.docs.reduce((sum, d) => sum + (d.data().totalAmount || 0), 0)
      setStats(s => ({ ...s, revenue }))
    }))

    return () => unsubs.forEach(u => u())
  }, [])

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h2 className="text-xl font-black text-gray-800">Overview</h2>
        <p className="text-sm text-gray-500">Friends Aqua Care — Admin Panel</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard icon="🔧" label="Total Jobs" value={stats.jobs} color="aqua" />
        <StatCard icon="⏳" label="Pending Jobs" value={stats.pending} color="yellow" />
        <StatCard icon="📦" label="Products" value={stats.products} color="blue" />
        <StatCard icon="👷" label="Technicians" value={stats.technicians} color="purple" />
        <StatCard icon="💰" label="Total Revenue" value={`₹${stats.revenue.toLocaleString('en-IN')}`} color="green" />
        <StatCard icon="⚠️" label="Missing Stock" value={stats.missing} color="red" />
      </div>

      <RecentJobs />
    </div>
  )
}

function RecentJobs() {
  const [jobs, setJobs] = useState([])

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'service_jobs'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5)
      setJobs(data)
    })
    return unsub
  }, [])

  const statusColor = { pending: 'bg-yellow-100 text-yellow-700', assigned: 'bg-blue-100 text-blue-700', in_progress: 'bg-purple-100 text-purple-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-bold text-gray-800">Recent Service Jobs</h3>
      </div>
      {jobs.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No jobs yet</div>
      ) : (
        <div className="divide-y divide-gray-50">
          {jobs.map(job => (
            <div key={job.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800 text-sm">{job.customerName || 'Customer'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{job.problemDescription || '—'}</p>
              </div>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusColor[job.status] || 'bg-gray-100 text-gray-600'}`}>
                {job.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
