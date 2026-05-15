import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

const STAT_CARDS = [
  { key: 'jobs',        icon: '🔧', label: 'Total Jobs',     gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'pending',     icon: '⏳', label: 'Pending Jobs',   gradient: 'from-amber-500 to-orange-600' },
  { key: 'technicians', icon: '👷', label: 'Technicians',    gradient: 'from-violet-500 to-purple-600' },
  { key: 'products',    icon: '📦', label: 'Products',       gradient: 'from-blue-500 to-blue-600' },
  { key: 'revenue',     icon: '💰', label: 'Total Revenue',  gradient: 'from-emerald-500 to-green-600' },
  { key: 'missing',     icon: '⚠️', label: 'Missing Stock',  gradient: 'from-red-500 to-rose-600' },
]

const STATUS_META_DARK = {
  pending:     { color: 'bg-amber-500/20 text-amber-400',   dot: 'bg-amber-400' },
  assigned:    { color: 'bg-blue-500/20 text-blue-400',     dot: 'bg-blue-400' },
  in_progress: { color: 'bg-violet-500/20 text-violet-400', dot: 'bg-violet-400' },
  completed:   { color: 'bg-emerald-500/20 text-emerald-400', dot: 'bg-emerald-400' },
}

const STATUS_META_LIGHT = {
  pending:     { color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
  assigned:    { color: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500' },
  in_progress: { color: 'bg-violet-100 text-violet-700', dot: 'bg-violet-500' },
  completed:   { color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
}

export default function AdminHome() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [stats, setStats] = useState({ jobs: 0, pending: 0, products: 0, technicians: 0, revenue: 0, missing: 0, unreadInvoices: 0 })
  const [recentJobs, setRecentJobs] = useState([])

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'service_jobs'), snap => {
      const data = snap.docs.map(d => d.data())
      const pending = data.filter(d => ['pending', 'assigned'].includes(d.status)).length
      setStats(s => ({ ...s, jobs: snap.size, pending }))
      setRecentJobs(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 6)
      )
    }))
    unsubs.push(onSnapshot(collection(db, 'products'), snap => setStats(s => ({ ...s, products: snap.size }))))
    unsubs.push(onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap => setStats(s => ({ ...s, technicians: snap.size }))))
    unsubs.push(onSnapshot(collection(db, 'invoices'), snap => {
      const revenue = snap.docs.reduce((sum, d) => sum + (d.data().totalAmount || 0), 0)
      const unreadInvoices = snap.docs.filter(d => d.data().submittedByTechnician && !d.data().adminViewed).length
      setStats(s => ({ ...s, revenue, unreadInvoices }))
    }))
    unsubs.push(onSnapshot(collection(db, 'job_stock_assignment'), snap => {
      const missing = snap.docs.reduce((sum, d) => {
        const x = d.data()
        const m = (x.assignedQuantity || 0) - (x.usedQuantity || 0) - (x.returnedQuantity || 0)
        return sum + (m > 0 ? m : 0)
      }, 0)
      setStats(s => ({ ...s, missing }))
    }))
    return () => unsubs.forEach(u => u())
  }, [])

  const getValue = (key) => key === 'revenue' ? `₹${stats.revenue.toLocaleString('en-IN')}` : stats[key]

  return (
    <div className="space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-3xl p-8 border ${
          isDark 
            ? 'glass-strong border-cyan-500/20' 
            : 'bg-gradient-to-br from-sky-500 to-cyan-600 border-sky-400/30 shadow-xl'
        }`}
      >
        <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full blur-3xl ${
          isDark ? 'bg-cyan-500/10' : 'bg-white/20'
        }`} />
        <div className={`absolute -bottom-10 -left-10 w-48 h-48 rounded-full blur-3xl ${
          isDark ? 'bg-cyan-600/10' : 'bg-white/10'
        }`} />
        <div className="relative">
          <p className={`text-sm font-medium ${isDark ? 'text-white/50' : 'text-white/80'}`}>Good day 👋</p>
          <h1 className="text-4xl font-black text-white mt-1">Admin Panel</h1>
          <p className={`text-sm mt-2 ${isDark ? 'text-white/60' : 'text-white/90'}`}>💧 Friends Aqua Care — Service Management</p>
        </div>
      </motion.div>

      {/* Invoice notification */}
      {stats.unreadInvoices > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => navigate('/admin/invoices')}
          className={`relative overflow-hidden rounded-2xl p-5 flex items-center justify-between cursor-pointer border transition group ${
            isDark 
              ? 'glass-strong border-rose-500/30 hover:border-rose-400/50' 
              : 'bg-white border-rose-300 hover:border-rose-400 shadow-lg'
          }`}
        >
          <div className={`absolute inset-0 ${
            isDark ? 'bg-gradient-to-r from-rose-500/10 to-pink-600/10' : 'bg-gradient-to-r from-rose-50 to-pink-50'
          }`} />
          <div className="relative flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
              isDark ? 'bg-rose-500/20' : 'bg-rose-100'
            }`}>🔔</div>
            <div>
              <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>New Invoice Notifications</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                {stats.unreadInvoices} invoice{stats.unreadInvoices > 1 ? 's' : ''} awaiting review
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-3">
            <span className={`w-10 h-10 text-sm font-black rounded-xl flex items-center justify-center shadow-lg ${
              isDark ? 'bg-rose-500 text-white' : 'bg-rose-500 text-white'
            }`}>
              {stats.unreadInvoices}
            </span>
            <span className={`text-xl group-hover:translate-x-1 transition-transform ${
              isDark ? 'text-white/40' : 'text-gray-400'
            }`}>›</span>
          </div>
        </motion.div>
      )}

      {/* Stats */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${
          isDark ? 'text-white/40' : 'text-gray-500'
        }`}>OVERVIEW</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {STAT_CARDS.map((card, i) => (
            <motion.div
              key={card.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className={`relative overflow-hidden rounded-2xl p-5 border group cursor-pointer ${
                isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-md hover:shadow-xl'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} transition-opacity ${
                isDark ? 'opacity-0 group-hover:opacity-10' : 'opacity-0 group-hover:opacity-5'
              }`} />
              <div className="relative">
                <span className="text-3xl">{card.icon}</span>
                <p className={`text-3xl font-black mt-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>{getValue(card.key)}</p>
                <p className={`text-xs font-semibold mt-1 ${isDark ? 'text-white/50' : 'text-gray-600'}`}>{card.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recent jobs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={`rounded-3xl border overflow-hidden ${
          isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-lg'
        }`}
      >
        <div className={`px-6 py-5 border-b flex items-center justify-between ${
          isDark ? 'border-white/5' : 'border-sky-100'
        }`}>
          <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Recent Service Jobs</h3>
          <button onClick={() => navigate('/admin/jobs')} className={`text-xs font-bold transition ${
            isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-sky-600 hover:text-sky-700'
          }`}>
            View all →
          </button>
        </div>
        {recentJobs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-4xl mb-3">🔧</p>
            <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>No jobs yet</p>
          </div>
        ) : (
          <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-sky-100'}`}>
            {recentJobs.map((job, i) => {
              const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT
              const meta = STATUS_META[job.status] || STATUS_META.pending
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.04 }}
                  onClick={() => navigate('/admin/jobs')}
                  className={`px-6 py-4 flex items-center justify-between cursor-pointer transition group ${
                    isDark ? 'hover:bg-white/5' : 'hover:bg-sky-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${meta.dot} group-hover:shadow-lg transition`} />
                    <div>
                      <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.customerName}</p>
                      <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-600'}`}>
                        {job.serviceType || job.componentName || job.problemDescription || '—'}
                        {job.technicianName && ` · 👷 ${job.technicianName}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${meta.color}`}>
                    {job.status?.replace('_', ' ')}
                  </span>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

      {/* Quick actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${
          isDark ? 'text-white/40' : 'text-gray-500'
        }`}>QUICK ACTIONS</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'New Service Job', icon: '🔧', path: '/admin/jobs',      gradient: 'from-cyan-500 to-cyan-600' },
            { label: 'Add Technician',  icon: '👷', path: '/admin/employees', gradient: 'from-violet-500 to-purple-600' },
            { label: 'View Invoices',   icon: '🧾', path: '/admin/invoices',  gradient: 'from-emerald-500 to-green-600' },
            { label: 'Reports',         icon: '📊', path: '/admin/reports',   gradient: 'from-blue-500 to-blue-600' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className={`relative overflow-hidden rounded-2xl p-5 text-left border group ${
                isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-md hover:shadow-xl'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} transition-opacity ${
                isDark ? 'opacity-0 group-hover:opacity-20' : 'opacity-0 group-hover:opacity-10'
              }`} />
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl ${
                isDark ? 'bg-white/5' : 'bg-sky-100/50'
              }`} />
              <span className="text-3xl relative z-10">{action.icon}</span>
              <p className={`font-bold text-sm mt-3 relative z-10 ${isDark ? 'text-white' : 'text-gray-900'}`}>{action.label}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
