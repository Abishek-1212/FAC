import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useAuth } from '../../context/AuthContext'

const STAT_CARDS = [
  { key: 'jobs',        label: 'Total Jobs',    gradient: 'from-cyan-500 to-cyan-600' },
  { key: 'pending',     label: 'Pending Jobs',  gradient: 'from-amber-500 to-orange-600' },
  { key: 'technicians', label: 'Technicians',   gradient: 'from-violet-500 to-purple-600' },
  { key: 'products',    label: 'Products',      gradient: 'from-blue-500 to-blue-600' },
  { key: 'revenue',     label: 'Total Revenue', gradient: 'from-emerald-500 to-green-600' },
  { key: 'missing',     label: 'Missing Stock', gradient: 'from-red-500 to-rose-600' },
]

const QUICK_ACTIONS = [
  {
    label: 'Service Job',
    path: '/admin/jobs',
    gradient: 'from-cyan-500 to-blue-600',
    iconBg: 'bg-cyan-500/20',
    iconBgLight: 'bg-cyan-50',
    iconColor: 'text-cyan-400',
    iconColorLight: 'text-cyan-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Follow-up Service',
    path: '/admin/follow-up',
    gradient: 'from-purple-500 to-pink-600',
    iconBg: 'bg-purple-500/20',
    iconBgLight: 'bg-purple-50',
    iconColor: 'text-purple-400',
    iconColorLight: 'text-purple-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'View Invoices',
    path: '/admin/invoices',
    gradient: 'from-emerald-500 to-green-600',
    iconBg: 'bg-emerald-500/20',
    iconBgLight: 'bg-emerald-50',
    iconColor: 'text-emerald-400',
    iconColorLight: 'text-emerald-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    label: 'Verify Stock',
    path: '/admin/verify-stock',
    gradient: 'from-blue-500 to-indigo-600',
    iconBg: 'bg-blue-500/20',
    iconBgLight: 'bg-blue-50',
    iconColor: 'text-blue-400',
    iconColorLight: 'text-blue-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'Technician Attendance',
    path: '/admin/attendance',
    gradient: 'from-teal-500 to-cyan-600',
    iconBg: 'bg-teal-500/20',
    iconBgLight: 'bg-teal-50',
    iconColor: 'text-teal-400',
    iconColorLight: 'text-teal-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Reports',
    path: '/admin/reports',
    gradient: 'from-orange-500 to-red-600',
    iconBg: 'bg-orange-500/20',
    iconBgLight: 'bg-orange-50',
    iconColor: 'text-orange-400',
    iconColorLight: 'text-orange-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: 'My Technicians',
    path: '/admin/employees',
    gradient: 'from-violet-500 to-purple-600',
    iconBg: 'bg-violet-500/20',
    iconBgLight: 'bg-violet-50',
    iconColor: 'text-violet-400',
    iconColorLight: 'text-violet-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
      </svg>
    ),
  },
  {
    label: 'Generate Invoice',
    path: '/admin/generate-invoice',
    gradient: 'from-orange-500 to-amber-600',
    iconBg: 'bg-orange-500/20',
    iconBgLight: 'bg-orange-50',
    iconColor: 'text-orange-400',
    iconColorLight: 'text-orange-600',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
]

export default function AdminHome() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const { profile } = useAuth()
  const [stats, setStats] = useState({ jobs: 0, pending: 0, products: 0, technicians: 0, revenue: 0, missing: 0, unreadInvoices: 0 })

  useEffect(() => {
    const batch = {}
    let flushTimer = null
    const flush = (patch) => {
      Object.assign(batch, patch)
      clearTimeout(flushTimer)
      flushTimer = setTimeout(() => setStats(s => ({ ...s, ...batch })), 50)
    }

    const unsubs = [
      onSnapshot(
        query(collection(db, 'users'), where('role', '==', 'technician')),
        snap => flush({ technicians: snap.size })
      ),
      onSnapshot(collection(db, 'service_jobs'), snap => {
        const jobs = snap.docs.map(d => d.data())
        flush({ jobs: snap.size, pending: jobs.filter(j => ['pending', 'assigned'].includes(j.status)).length })
      }),
      onSnapshot(collection(db, 'products'), snap => flush({ products: snap.size })),
      onSnapshot(collection(db, 'invoices'), snap => {
        const revenue = snap.docs.reduce((sum, d) => sum + (d.data().amountReceived || 0), 0)
        const unreadInvoices = snap.docs.filter(d => d.data().submittedByTechnician && !d.data().adminViewed).length
        flush({ revenue, unreadInvoices })
      }),
      onSnapshot(collection(db, 'job_stock_assignment'), snap => {
        const missing = snap.docs.reduce((sum, d) => {
          const x = d.data()
          const m = (x.assignedQuantity || 0) - (x.usedQuantity || 0) - (x.returnedQuantity || 0)
          return sum + (m > 0 ? m : 0)
        }, 0)
        flush({ missing })
      }),
    ]

    return () => { clearTimeout(flushTimer); unsubs.forEach(u => u()) }
  }, [])

  const useCounter = (target) => {
    const [count, setCount] = useState(0)
    const prev = useRef(0)
    useEffect(() => {
      const start = prev.current
      const diff = target - start
      if (diff === 0) return
      const duration = 400
      const startTime = performance.now()
      const frame = (now) => {
        const progress = Math.min((now - startTime) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        setCount(Math.round(start + diff * ease))
        if (progress < 1) requestAnimationFrame(frame)
        else prev.current = target
      }
      requestAnimationFrame(frame)
    }, [target])
    return count
  }

  const jobs        = useCounter(stats.jobs)
  const pending     = useCounter(stats.pending)
  const technicians = useCounter(stats.technicians)
  const products    = useCounter(stats.products)
  const revenue     = useCounter(stats.revenue)
  const missing     = useCounter(stats.missing)

  const counted = { jobs, pending, technicians, products, revenue, missing }
  const getValue = (key) => key === 'revenue' ? `₹${counted.revenue.toLocaleString('en-IN')}` : counted[key]

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
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => navigate(action.path)}
              className={`relative rounded-2xl p-4 text-left transition-all duration-150 select-none ${
                isDark
                  ? 'bg-[#1a1f2e] shadow-[6px_6px_14px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.04)] active:shadow-[2px_2px_6px_rgba(0,0,0,0.5),-1px_-1px_4px_rgba(255,255,255,0.03)] active:translate-y-px'
                  : 'bg-[#eef0f5] shadow-[6px_6px_14px_rgba(174,179,198,0.7),-6px_-6px_14px_rgba(255,255,255,0.9)] active:shadow-[2px_2px_6px_rgba(174,179,198,0.6),-2px_-2px_6px_rgba(255,255,255,0.8)] active:translate-y-px'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  isDark
                    ? `${action.iconBg} ${action.iconColor} shadow-[inset_2px_2px_5px_rgba(0,0,0,0.4),inset_-2px_-2px_5px_rgba(255,255,255,0.04)]`
                    : `${action.iconBgLight} ${action.iconColorLight} shadow-[inset_2px_2px_5px_rgba(174,179,198,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.8)]`
                }`}>
                  {action.icon}
                </div>
                <p className={`font-bold text-sm leading-tight ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{action.label}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>OVERVIEW</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {STAT_CARDS.map((card) => (
            <div
              key={card.key}
              className={`relative rounded-2xl p-5 transition-all duration-150 ${
                isDark
                  ? 'bg-[#1a1f2e] shadow-[6px_6px_14px_rgba(0,0,0,0.5),-4px_-4px_10px_rgba(255,255,255,0.04)]'
                  : 'bg-[#eef0f5] shadow-[6px_6px_14px_rgba(174,179,198,0.7),-6px_-6px_14px_rgba(255,255,255,0.9)]'
              }`}
            >
              <div className={`absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-gradient-to-br ${card.gradient}`} />
              <p className={`text-3xl font-black ${isDark ? 'text-white' : 'text-gray-800'}`}>{getValue(card.key)}</p>
              <p className={`text-xs font-semibold mt-2 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{card.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
