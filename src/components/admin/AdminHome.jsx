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
  { key: 'jobs',        icon: '🔧', label: 'Total Jobs',    gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'pending',     icon: '⏳', label: 'Pending Jobs',  gradient: 'from-amber-500 to-orange-600' },
  { key: 'technicians', icon: '👷', label: 'Technicians',   gradient: 'from-violet-500 to-purple-600' },
  { key: 'products',    icon: '📦', label: 'Products',      gradient: 'from-blue-500 to-blue-600' },
  { key: 'revenue',     icon: '💰', label: 'Total Revenue', gradient: 'from-emerald-500 to-green-600' },
  { key: 'missing',     icon: '⚠️', label: 'Missing Stock', gradient: 'from-red-500 to-rose-600' },
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
      const revenue = snap.docs.reduce((sum, d) => sum + (d.data().totalAmount || 0), 0)
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
      <motion.div 
        initial={{ opacity: 0, y: -10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className={`rounded-2xl p-6 text-white bg-gradient-to-r from-aqua-500 to-cyan-600 shadow-lg relative`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-white/70 text-sm font-medium">Welcome back 👋</p>
            <h2 className="text-3xl font-black mt-1">{profile?.name?.split(' ')[0] || 'Admin'}</h2>
            <p className="text-white/60 text-sm mt-2">Managing {stats.jobs} total jobs</p>
          </div>
          
          {/* Avatar with Dropdown */}
          <div className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={(e) => {
                e.stopPropagation()
                setShowAvatarMenu(!showAvatarMenu)
              }}
              className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center font-bold text-white hover:bg-white/30 transition-all"
            >
              {getInitials(profile?.name)}
            </motion.button>

            <AnimatePresence>
              {showAvatarMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAvatarMenu(false)}
                    className="fixed inset-0 z-40"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className="absolute right-0 top-14 w-48 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAvatarMenu(false)
                        navigate('/admin/profile')
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">👤</span>
                      View Profile
                    </button>
                    <div className="h-px bg-gray-100" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowAvatarMenu(false)
                        handleLogout()
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                    >
                      <span className="text-lg">🚪</span>
                      Logout
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
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
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'New Service Job', icon: '🔧', path: '/admin/jobs',      gradient: 'from-cyan-500 to-cyan-600' },
            { label: 'Add Technician',  icon: '👷', path: '/admin/employees', gradient: 'from-violet-500 to-purple-600' },
            { label: 'Verify Stock',    icon: '✅', path: '/admin/verify-stock', gradient: 'from-blue-500 to-indigo-600' },
            { label: 'View Invoices',   icon: '🧾', path: '/admin/invoices',  gradient: 'from-emerald-500 to-green-600' },
            { label: 'Reports',         icon: '📊', path: '/admin/reports',   gradient: 'from-orange-500 to-red-600' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className={`relative overflow-hidden rounded-2xl p-5 text-left border group ${
                isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-md hover:shadow-xl'
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
              <span className="text-3xl relative z-10">{action.icon}</span>
              <p className={`font-bold text-sm mt-3 relative z-10 ${isDark ? 'text-white' : 'text-gray-900'}`}>{action.label}</p>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Recent Jobs */}
      <RecentServiceJobs jobs={recentJobs} />

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
