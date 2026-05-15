import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import StatCard from '../common/StatCard'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function TechnicianHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [filter, setFilter] = useState('active')

  useEffect(() => {
    if (!user) return
    return onSnapshot(query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid)), snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    })
  }, [user])

  const active = jobs.filter(j => ['assigned', 'in_progress'].includes(j.status))
  const completed = jobs.filter(j => j.status === 'completed')
  const filtered = filter === 'active' ? active : filter === 'completed' ? completed : jobs

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div>
        <h2 className="text-xl font-black text-gray-800">Hello, {profile?.name?.split(' ')[0]} 👋</h2>
        <p className="text-sm text-gray-500">Your assigned service jobs</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard icon="⏳" label="Active" value={active.length} color="yellow" />
        <StatCard icon="✅" label="Done" value={completed.length} color="green" />
        <StatCard icon="📋" label="Total" value={jobs.length} color="aqua" />
      </div>

      <div className="flex gap-2">
        {[['active', 'Active'], ['completed', 'Completed'], ['all', 'All']].map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)} className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${filter === val ? 'bg-aqua-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map(job => (
          <div key={job.id} onClick={() => navigate(`/technician/job/${job.id}`)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-aqua-200 transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-800">{job.customerName}</p>
                <p className="text-xs text-gray-500 mt-0.5">📞 {job.customerPhone}</p>
                <p className="text-xs text-gray-500">📍 {job.customerAddress}</p>
                <p className="text-sm text-gray-600 mt-1">{job.problemDescription}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[job.status]}`}>
                  {job.status?.replace('_', ' ')}
                </span>
                {job.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Urgent</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">🔧</p>
            <p className="text-gray-500 text-sm">No jobs in this category</p>
          </div>
        )}
      </div>
    </div>
  )
}
