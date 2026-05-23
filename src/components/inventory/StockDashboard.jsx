import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import StatCard from '../common/StatCard'

export default function StockDashboard() {
  const navigate = useNavigate()
  const { isDark } = useTheme()
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'inventory'), snap => setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u2 = onSnapshot(collection(db, 'stock_transactions'), snap => {
      setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)).slice(0, 10))
    })
    return () => { u1(); u2() }
  }, [])

  const totalItems = inventory.reduce((s, i) => s + (i.quantity || 0), 0)
  const lowStock = inventory.filter(i => i.quantity < 5).length

  const TYPE_COLORS = { purchase: 'bg-green-100 text-green-700', assignment: 'bg-blue-100 text-blue-700', return: 'bg-purple-100 text-purple-700', usage: 'bg-orange-100 text-orange-700' }

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      <div>
        <h2 className="text-xl font-black text-gray-800">Stock Dashboard</h2>
        <p className="text-sm text-gray-500">Inventory overview</p>
      </div>

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>QUICK ACTIONS</p>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Receive Stock', icon: '📥', path: '/inventory/receive', gradient: 'from-green-500 to-emerald-600' },
            { label: 'Verify Returns', icon: '↩️', path: '/inventory/returns', gradient: 'from-purple-500 to-purple-600' },
          ].map((action, i) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + i * 0.05 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(action.path)}
              className={`relative overflow-hidden rounded-2xl p-5 text-left border group ${isDark ? 'glass-strong border-white/5' : 'bg-white border-sky-200 shadow-md hover:shadow-xl'}`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} transition-opacity ${isDark ? 'opacity-0 group-hover:opacity-20' : 'opacity-0 group-hover:opacity-10'}`} />
              <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl ${isDark ? 'bg-white/5' : 'bg-sky-100/50'}`} />
              <span className="text-3xl relative z-10">{action.icon}</span>
              <p className={`font-bold text-sm mt-3 relative z-10 ${isDark ? 'text-white' : 'text-gray-900'}`}>{action.label}</p>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon="📦" label="Total Items" value={totalItems} color="aqua" />
        <StatCard icon="⚠️" label="Low Stock" value={lowStock} color={lowStock > 0 ? 'red' : 'green'} />
        <StatCard icon="📋" label="Product Types" value={inventory.length} color="blue" />
        <StatCard icon="🔄" label="Recent Moves" value={transactions.length} color="purple" />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Current Stock Levels</h3>
        </div>
        {inventory.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No inventory data. Add stock first.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {inventory.map(item => (
              <div key={item.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{item.productName}</p>
                  <p className="text-xs text-gray-500">{item.category || ''}</p>
                </div>
                <div className="text-right">
                  <p className={`font-black text-lg ${item.quantity < 5 ? 'text-red-500' : 'text-green-600'}`}>{item.quantity}</p>
                  {item.quantity < 5 && <p className="text-xs text-red-400">Low stock</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Recent Transactions</h3>
        </div>
        {transactions.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No transactions yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {transactions.map(t => (
              <div key={t.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{t.productName}</p>
                  <p className="text-xs text-gray-500">{t.notes || ''}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[t.type] || 'bg-gray-100 text-gray-600'}`}>{t.type}</span>
                  <p className="text-sm font-bold text-gray-700 mt-1">×{t.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
