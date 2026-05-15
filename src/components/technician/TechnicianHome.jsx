import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const STATUS_META = {
  pending:     { color: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400' },
  assigned:    { color: 'bg-blue-100 text-blue-700 border-blue-200',          dot: 'bg-blue-400' },
  in_progress: { color: 'bg-violet-100 text-violet-700 border-violet-200',    dot: 'bg-violet-400' },
  completed:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
}

export default function TechnicianHome() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [jobs, setJobs]     = useState([])
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid)),
      snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
  }, [user])

  const pending   = jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status))
  const completed = jobs.filter(j => j.status === 'completed')
  const filtered  = filter === 'all' ? jobs : filter === 'pending' ? pending : completed

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-gradient-to-r from-aqua-500 to-aqua-700 rounded-2xl p-5 text-white">
        <p className="text-white/70 text-sm">Welcome back 👋</p>
        <h2 className="text-2xl font-black mt-0.5">{profile?.name?.split(' ')[0]}</h2>
        <div className="flex gap-4 mt-3">
          <div className="text-center">
            <p className="text-2xl font-black">{pending.length}</p>
            <p className="text-white/70 text-xs">Pending</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-black">{completed.length}</p>
            <p className="text-white/70 text-xs">Completed</p>
          </div>
          <div className="w-px bg-white/20" />
          <div className="text-center">
            <p className="text-2xl font-black">{jobs.length}</p>
            <p className="text-white/70 text-xs">Total</p>
          </div>
        </div>
      </motion.div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[
          { key: 'pending',   label: 'Pending',   count: pending.length },
          { key: 'completed', label: 'Completed', count: completed.length },
          { key: 'all',       label: 'All',       count: jobs.length },
        ].map(({ key, label, count }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filter === key
                ? 'bg-aqua-500 text-white shadow-md shadow-aqua-200'
                : 'bg-white text-gray-500 border border-gray-200'
            }`}
          >
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${filter === key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
              {count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Job cards */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3">
          {filtered.map((job, i) => {
            const meta = STATUS_META[job.status] || STATUS_META.pending
            return (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => navigate(`/technician/job/${job.id}`)}
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-aqua-200 transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <p className="font-bold text-gray-900 truncate">{job.customerName}</p>
                      {job.priority === 'urgent' && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Urgent</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 ml-4">📞 {job.customerPhone}</p>
                    <p className="text-xs text-gray-400 ml-4">📍 {job.customerAddress}</p>
                    {job.serviceType && (
                      <span className={`ml-4 mt-1.5 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        job.serviceType === 'New Fitting' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                      </span>
                    )}
                    {job.componentName && (
                      <p className="text-xs text-aqua-600 ml-4 mt-1 font-medium">🔩 {job.componentName}</p>
                    )}
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${meta.color}`}>
                    {job.status?.replace('_', ' ')}
                  </span>
                </div>
              </motion.div>
            )
          })}
          {filtered.length === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
              <p className="text-4xl mb-3">🔧</p>
              <p className="text-gray-400 text-sm font-medium">No jobs in this category</p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>
    </div>
  )
}
