import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function CustomerHome() {
  const { profile } = useAuth()
  const [jobs, setJobs] = useState([])
  const [reminders, setReminders] = useState([])

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'service_jobs'), where('customerPhone', '==', profile?.phone || '')), snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    })
    return u1
  }, [profile])

  const upcoming = reminders.filter(r => r.status === 'pending')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div className="bg-gradient-to-r from-aqua-500 to-aqua-700 rounded-2xl p-5 text-white">
        <p className="text-white/70 text-sm">Welcome back</p>
        <h2 className="text-2xl font-black mt-0.5">{profile?.name}</h2>
        <p className="text-white/80 text-sm mt-2">💧 Friends Aqua Care — Your trusted RO service partner</p>
      </div>

      {upcoming.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
          <p className="font-bold text-yellow-800 text-sm">🔔 Upcoming Service Reminders</p>
          {upcoming.map(r => (
            <p key={r.id} className="text-yellow-700 text-sm mt-1">Service due: {r.nextServiceDate?.toDate?.()?.toLocaleDateString('en-IN') || 'Soon'}</p>
          ))}
        </div>
      )}

      <div>
        <h3 className="font-bold text-gray-800 mb-3">Service History</h3>
        {jobs.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
            <p className="text-4xl mb-3">🔧</p>
            <p className="text-gray-500 text-sm">No service requests yet</p>
            <p className="text-gray-400 text-xs mt-1">Contact us to schedule a service</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{job.problemDescription}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{job.technicianName ? `Technician: ${job.technicianName}` : 'Awaiting assignment'}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {job.createdAt?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-600'}`}>
                    {job.status?.replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-aqua-50 rounded-2xl p-4 border border-aqua-100">
        <p className="font-bold text-aqua-800 text-sm mb-2">📞 Contact Us</p>
        <p className="text-aqua-700 text-sm">For service requests or queries, call your service center directly.</p>
      </div>
    </div>
  )
}
