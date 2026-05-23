import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'
import RecentServiceJobs from './RecentServiceJobs'

// ── Stock Bar Component ───────────────────────────────────────────────────────
function StockBar({ label, value, max, color, isDark }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{label}</span>
        <span className={`text-xs font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{value}</span>
      </div>
      <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, minWidth: value > 0 ? '8px' : '0px' }}
        />
      </div>
    </div>
  )
}

const STAT_CARDS = [
  { key: 'jobs',        label: 'Total Jobs',    gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'pending',     label: 'Pending Jobs',  gradient: 'from-amber-500 to-orange-600' },
  { key: 'technicians', label: 'Technicians',   gradient: 'from-violet-500 to-purple-600' },
  { key: 'products',    label: 'Products',      gradient: 'from-blue-500 to-blue-600' },
  { key: 'revenue',     label: 'Total Revenue', gradient: 'from-emerald-500 to-green-600' },
  { key: 'missing',     label: 'Missing Stock', gradient: 'from-red-500 to-rose-600' },
]

export default function AdminHome() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { profile, logout } = useAuth()
  const [stats, setStats] = useState({ jobs: 0, pending: 0, products: 0, technicians: 0, revenue: 0, missing: 0, unreadInvoices: 0 })
  const [recentJobs, setRecentJobs] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [techStock, setTechStock] = useState([])
  const [stockNotifications, setStockNotifications] = useState([])
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)

  useEffect(() => {
    const unsubs = []

    // Technicians
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => {
        setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
        setStats(s => ({ ...s, technicians: snap.size }))
      }
    ))

    // Technician stock — from technician_stock collection
    unsubs.push(onSnapshot(
      collection(db, 'technician_stock'),
      snap => setTechStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))

    // Service jobs
    unsubs.push(onSnapshot(collection(db, 'service_jobs'), snap => {
      const jobs = snap.docs.map(d => d.data())
      setStats(s => ({ ...s, jobs: snap.size, pending: jobs.filter(j => ['pending', 'assigned'].includes(j.status)).length }))
      setRecentJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    }))

    // Products
    unsubs.push(onSnapshot(collection(db, 'products'), snap => setStats(s => ({ ...s, products: snap.size }))))

    // Invoices
    unsubs.push(onSnapshot(collection(db, 'invoices'), snap => {
      const revenue = snap.docs.reduce((sum, d) => sum + (d.data().amountReceived || 0), 0)
      const unreadInvoices = snap.docs.filter(d => d.data().submittedByTechnician && !d.data().adminViewed).length
      setStats(s => ({ ...s, revenue, unreadInvoices }))
    }))

    // Missing stock
    unsubs.push(onSnapshot(collection(db, 'job_stock_assignment'), snap => {
      const missing = snap.docs.reduce((sum, d) => {
        const x = d.data()
        const m = (x.assignedQuantity || 0) - (x.usedQuantity || 0) - (x.returnedQuantity || 0)
        return sum + (m > 0 ? m : 0)
      }, 0)
      setStats(s => ({ ...s, missing }))
    }))

    // Stock taken notifications
    unsubs.push(onSnapshot(
      query(collection(db, 'notifications'), where('type', '==', 'stock_taken')),
      snap => {
        const notifications = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 5) // Show only last 5
        setStockNotifications(notifications)
      }
    ))

    return () => unsubs.forEach(u => u())
  }, [])

  const getValue = (key) => key === 'revenue' ? `₹${stats.revenue.toLocaleString('en-IN')}` : stats[key]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return 'A'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Hi, {profile?.name?.split(' ')[0] || 'Admin'}
          </h1>
          <p className={`text-sm mt-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
            Welcome to your dashboard
          </p>
        </div>
      </div>

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
          <div className={`absolute inset-0 ${isDark ? 'bg-gradient-to-r from-rose-500/10 to-pink-600/10' : 'bg-gradient-to-r from-rose-50 to-pink-50'}`} />
          <div className="relative flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${isDark ? 'bg-rose-500/20' : 'bg-rose-100'}`}>🔔</div>
            <div>
              <p className={`font-black text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>New Invoice Notifications</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                {stats.unreadInvoices} invoice{stats.unreadInvoices > 1 ? 's' : ''} awaiting review
              </p>
            </div>
          </div>
          <div className="relative flex items-center gap-3">
            <span className="w-10 h-10 text-sm font-black rounded-xl flex items-center justify-center shadow-lg bg-rose-500 text-white">
              {stats.unreadInvoices}
            </span>
            <span className={`text-xl group-hover:translate-x-1 transition-transform ${isDark ? 'text-white/40' : 'text-gray-400'}`}>›</span>
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>QUICK ACTIONS</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Service Job', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>, path: '/admin/jobs', gradient: 'from-cyan-500 to-blue-600', iconBg: isDark ? 'bg-cyan-500/20' : 'bg-cyan-50', iconColor: isDark ? 'text-cyan-400' : 'text-cyan-600' },
            { label: 'View Invoices', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>, path: '/admin/invoices', gradient: 'from-emerald-500 to-green-600', iconBg: isDark ? 'bg-emerald-500/20' : 'bg-emerald-50', iconColor: isDark ? 'text-emerald-400' : 'text-emerald-600' },
            { label: 'Verify Stock', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>, path: '/admin/verify-stock', gradient: 'from-blue-500 to-indigo-600', iconBg: isDark ? 'bg-blue-500/20' : 'bg-blue-50', iconColor: isDark ? 'text-blue-400' : 'text-blue-600' },
            { label: 'Reports', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>, path: '/admin/reports', gradient: 'from-orange-500 to-red-600', iconBg: isDark ? 'bg-orange-500/20' : 'bg-orange-50', iconColor: isDark ? 'text-orange-400' : 'text-orange-600' },
            { label: 'Add Technician', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>, path: '/admin/employees', gradient: 'from-violet-500 to-purple-600', iconBg: isDark ? 'bg-violet-500/20' : 'bg-violet-50', iconColor: isDark ? 'text-violet-400' : 'text-violet-600' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className={`relative overflow-hidden rounded-xl p-4 text-left border transition-all ${
                isDark ? 'bg-dark-card border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm hover:shadow-md'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 hover:opacity-5 transition-opacity`} />
              <div className="relative flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg ${action.iconBg} flex items-center justify-center ${action.iconColor}`}>
                  {action.icon}
                </div>
                <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{action.label}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>OVERVIEW</p>
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
              <div className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-5 transition-opacity`} />
              <div className="relative">
                <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>{getValue(card.key)}</p>
                <p className={`text-xs font-semibold mt-2 ${isDark ? 'text-white/50' : 'text-gray-600'}`}>{card.label}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

    </div>
  )
}
