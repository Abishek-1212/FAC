import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'

export default function TechnicianStockDetail() {
  const { isDark } = useTheme()
  const [technicians, setTechnicians] = useState([])
  const [techStock, setTechStock] = useState([])

  useEffect(() => {
    const unsubs = []

    // Get all technicians
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))

    // Get all technician stock
    unsubs.push(onSnapshot(
      collection(db, 'technician_stock'),
      snap => setTechStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))

    return () => unsubs.forEach(u => u())
  }, [])

  const getTechnicianStock = (techId) => {
    return techStock.filter(s => s.technicianId === techId && s.status === 'active')
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className={`p-2 rounded-xl transition-all ${
              isDark
                ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10'
                : 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <h2 className={`text-2xl font-black ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Technician Stock Details
            </h2>
            <p className={`text-sm mt-0.5 ${
              isDark ? 'text-white/40' : 'text-gray-400'
            }`}>
              Component-wise stock breakdown
            </p>
          </div>
        </div>
      </div>

      {/* Technicians List */}
      {technicians.length === 0 ? (
        <div className={`rounded-2xl p-12 text-center border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
        }`}>
          <p className="text-4xl mb-3">👷</p>
          <p className={`text-sm ${
            isDark ? 'text-white/40' : 'text-gray-400'
          }`}>
            No technicians found
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {technicians.map((tech, i) => {
            const stockItems = getTechnicianStock(tech.id)
            const totalTaken = stockItems.reduce((sum, s) => sum + (s.takenQuantity || 0), 0)
            const totalUsed = stockItems.reduce((sum, s) => sum + (s.usedQuantity || 0), 0)
            const totalReturned = stockItems.reduce((sum, s) => sum + (s.returnedQuantity || 0), 0)
            const totalRemaining = Math.max(totalTaken - totalUsed - totalReturned, 0)

            return (
              <motion.div
                key={tech.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl border overflow-hidden ${
                  isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200 shadow-lg'
                }`}
              >
                {/* Technician Header */}
                <div className={`px-6 py-5 border-b ${
                  isDark 
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-white/10' 
                    : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-gray-200'
                }`}>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg ${
                      isDark ? 'bg-cyan-500/30 text-cyan-300' : 'bg-cyan-500 text-white'
                    }`}>
                      {(tech.name || 'T').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className={`font-black text-xl ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {tech.name || 'Unknown'}
                      </p>
                      <p className={`text-sm ${
                        isDark ? 'text-white/60' : 'text-gray-600'
                      }`}>
                        📞 {tech.phone || tech.phoneNumber || '—'}
                      </p>
                    </div>
                    {/* Overall Summary Badge */}
                    <div className={`text-center px-6 py-3 rounded-xl ${
                      isDark ? 'bg-white/10' : 'bg-white shadow-md'
                    }`}>
                      <p className={`text-3xl font-black ${
                        isDark ? 'text-cyan-400' : 'text-cyan-600'
                      }`}>
                        {totalTaken}
                      </p>
                      <p className={`text-xs font-semibold ${
                        isDark ? 'text-white/50' : 'text-gray-500'
                      }`}>
                        Total Taken
                      </p>
                    </div>
                  </div>
                </div>

                {/* Components Grid */}
                {stockItems.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <p className="text-4xl mb-3">📦</p>
                    <p className={`text-sm ${
                      isDark ? 'text-white/40' : 'text-gray-400'
                    }`}>
                      No stock assigned yet
                    </p>
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {stockItems.map((item, idx) => {
                        const remaining = Math.max(
                          (item.takenQuantity || 0) - 
                          (item.usedQuantity || 0) - 
                          (item.returnedQuantity || 0) - 
                          (item.damagedQuantity || 0), 
                          0
                        )
                        
                        return (
                          <motion.div
                            key={item.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: idx * 0.05 }}
                            className={`rounded-2xl p-5 border-2 ${
                              isDark
                                ? 'bg-gradient-to-br from-white/5 to-white/[0.02] border-white/10 hover:border-cyan-500/30'
                                : 'bg-gradient-to-br from-white to-gray-50 border-gray-200 hover:border-cyan-300 hover:shadow-xl'
                            } transition-all`}
                          >
                            {/* Component Name */}
                            <div className="mb-4">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h3 className={`font-black text-lg leading-tight ${
                                  isDark ? 'text-white' : 'text-gray-900'
                                }`}>
                                  {item.productName}
                                </h3>
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${
                                  remaining > 0
                                    ? isDark
                                      ? 'bg-amber-500/20 text-amber-300'
                                      : 'bg-amber-100 text-amber-700'
                                    : isDark
                                    ? 'bg-green-500/20 text-green-300'
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {remaining > 0 ? `${remaining} left` : 'All used'}
                                </span>
                              </div>
                              {item.productPrice && (
                                <p className={`text-xs font-semibold ${
                                  isDark ? 'text-cyan-400' : 'text-cyan-600'
                                }`}>
                                  ₹{item.productPrice.toLocaleString('en-IN')} per unit
                                </p>
                              )}
                            </div>

                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {[
                                { 
                                  label: 'Taken', 
                                  value: item.takenQuantity || 0, 
                                  icon: '📦', 
                                  color: isDark ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
                                },
                                { 
                                  label: 'Used', 
                                  value: item.usedQuantity || 0, 
                                  icon: '✓', 
                                  color: isDark ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200'
                                },
                                { 
                                  label: 'Returned', 
                                  value: item.returnedQuantity || 0, 
                                  icon: '↩', 
                                  color: isDark ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-700 border-purple-200'
                                },
                                { 
                                  label: 'Damaged', 
                                  value: item.damagedQuantity || 0, 
                                  icon: '✕', 
                                  color: isDark ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-red-50 text-red-700 border-red-200'
                                },
                              ].map(stat => (
                                <div
                                  key={stat.label}
                                  className={`rounded-xl p-3 border text-center ${stat.color}`}
                                >
                                  <div className="text-xl mb-1">{stat.icon}</div>
                                  <div className="text-2xl font-black mb-0.5">{stat.value}</div>
                                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                                    {stat.label}
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Timestamp */}
                            {item.takenAt && (
                              <div className={`pt-3 border-t text-xs ${
                                isDark ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-500'
                              }`}>
                                <p className="font-semibold">
                                  📅 Taken: {item.takenAt.toDate ? 
                                    new Date(item.takenAt.toDate()).toLocaleDateString('en-IN', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    }) : 'N/A'}
                                </p>
                              </div>
                            )}
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
