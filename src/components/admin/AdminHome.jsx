import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import RecentServiceJobs from './RecentServiceJobs'

const STAT_CARDS = [
  { key: 'jobs',        icon: '🔧', label: 'Total Jobs',     gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'pending',     icon: '⏳', label: 'Pending Jobs',   gradient: 'from-amber-500 to-orange-600' },
  { key: 'technicians', icon: '👷', label: 'Technicians',    gradient: 'from-violet-500 to-purple-600' },
  { key: 'products',    icon: '📦', label: 'Products',       gradient: 'from-blue-500 to-blue-600' },
  { key: 'revenue',     icon: '💰', label: 'Total Revenue',  gradient: 'from-emerald-500 to-green-600' },
  { key: 'missing',     icon: '⚠️', label: 'Missing Stock',  gradient: 'from-red-500 to-rose-600' },
]

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

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${
          isDark ? 'text-white/40' : 'text-gray-500'
        }`}>QUICK ACTIONS</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'New Service Job', icon: '🔧', path: '/admin/jobs',      gradient: 'from-cyan-500 to-cyan-600' },
            { label: 'Add Product',     icon: '📦', path: '/admin/products',  gradient: 'from-blue-500 to-blue-600' },
            { label: 'Add Technician',  icon: '👷', path: '/admin/employees', gradient: 'from-violet-500 to-purple-600' },
            { label: 'View Invoices',   icon: '🧾', path: '/admin/invoices',  gradient: 'from-emerald-500 to-green-600' },
            { label: 'Reports',         icon: '📊', path: '/admin/reports',   gradient: 'from-orange-500 to-red-600' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
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

      {/* Recent jobs */}
      <RecentServiceJobs jobs={recentJobs} />

      {/* Overview Stats */}
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
    </div>
  )
}
