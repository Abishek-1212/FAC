import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, addDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

export default function ReturnStock() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const [myStock, setMyStock] = useState([])
  const [returnData, setReturnData] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'technician_stock'), where('technicianId', '==', user.uid), where('status', '==', 'active')),
      snap => {
        const stocks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setMyStock(stocks)
        
        // Initialize return data
        const initialData = {}
        stocks.forEach(s => {
          const remaining = s.takenQuantity - s.usedQuantity - s.returnedQuantity
          initialData[s.id] = {
            returning: 0,
            damaged: 0,
            remaining: remaining
          }
        })
        setReturnData(initialData)
      }
    )
  }, [user])

  const handleReturnChange = (stockId, field, value) => {
    const stock = myStock.find(s => s.id === stockId)
    const remaining = stock.takenQuantity - stock.usedQuantity - stock.returnedQuantity
    const data = returnData[stockId] || {}
    
    const newData = { ...data, [field]: Number(value) || 0 }
    const total = newData.returning + newData.damaged
    
    if (total > remaining) {
      toast.error('Total cannot exceed remaining quantity')
      return
    }
    
    setReturnData(prev => ({
      ...prev,
      [stockId]: { ...newData, remaining }
    }))
  }

  const handleReturnStock = async (stockId) => {
    const stock = myStock.find(s => s.id === stockId)
    const data = returnData[stockId]
    
    if (!data || (data.returning === 0 && data.damaged === 0)) {
      toast.error('Enter quantity to return or mark as damaged')
      return
    }

    setSaving(true)
    try {
      // Update technician stock record
      const newReturned = stock.returnedQuantity + data.returning
      const newUsed = stock.usedQuantity + data.damaged
      const newRemaining = stock.takenQuantity - newUsed - newReturned
      
      await updateDoc(doc(db, 'technician_stock', stockId), {
        returnedQuantity: newReturned,
        usedQuantity: newUsed,
        status: newRemaining === 0 ? 'completed' : 'active',
        lastReturnedAt: serverTimestamp(),
      })

      // Add returned stock back to company inventory
      if (data.returning > 0) {
        const invRef = doc(db, 'inventory', stock.productId)
        const invSnap = await getDoc(invRef)
        if (invSnap.exists()) {
          await updateDoc(invRef, {
            quantity: (invSnap.data().quantity || 0) + data.returning,
            lastUpdated: serverTimestamp(),
          })
        }

        // Log return transaction
        await addDoc(collection(db, 'stock_transactions'), {
          type: 'technician_return',
          productId: stock.productId,
          productName: stock.productName,
          quantity: data.returning,
          fromUser: profile?.name || 'Technician',
          technicianId: user.uid,
          timestamp: serverTimestamp(),
        })
      }

      // Log damaged items
      if (data.damaged > 0) {
        await addDoc(collection(db, 'stock_transactions'), {
          type: 'damaged',
          productId: stock.productId,
          productName: stock.productName,
          quantity: data.damaged,
          fromUser: profile?.name || 'Technician',
          technicianId: user.uid,
          timestamp: serverTimestamp(),
        })
      }

      toast.success('✅ Stock returned successfully')
      
      // Reset return data for this item
      setReturnData(prev => ({
        ...prev,
        [stockId]: { returning: 0, damaged: 0, remaining: newRemaining }
      }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalTaken = myStock.reduce((sum, s) => sum + s.takenQuantity, 0)
  const totalUsed = myStock.reduce((sum, s) => sum + s.usedQuantity, 0)
  const totalReturned = myStock.reduce((sum, s) => sum + s.returnedQuantity, 0)
  const totalRemaining = myStock.reduce((sum, s) => sum + (s.takenQuantity - s.usedQuantity - s.returnedQuantity), 0)

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Return Stock</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          Return unused products to company inventory
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Taken', value: totalTaken, icon: '📤', color: 'blue' },
          { label: 'Used', value: totalUsed, icon: '✓', color: 'green' },
          { label: 'Returned', value: totalReturned, icon: '↩', color: 'purple' },
          { label: 'Remaining', value: totalRemaining, icon: '📦', color: 'amber' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`rounded-2xl p-3 shadow-sm border ${
              isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
            }`}
          >
            <p className={`text-xs font-semibold uppercase tracking-wider ${
              isDark ? 'text-white/40' : 'text-gray-500'
            }`}>
              {stat.label}
            </p>
            <div className="flex items-end justify-between mt-2">
              <p className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stat.value}
              </p>
              <span className="text-xl">{stat.icon}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Stock Items */}
      <AnimatePresence mode="popLayout">
        {myStock.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-2xl p-12 text-center border border-dashed ${
              isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <p className="text-4xl mb-3">📦</p>
            <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              No stock to return
            </p>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            {myStock.map((stock, i) => {
              const remaining = stock.takenQuantity - stock.usedQuantity - stock.returnedQuantity
              const data = returnData[stock.id] || { returning: 0, damaged: 0 }
              
              return (
                <motion.div
                  key={stock.id}
                  layout
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl p-4 shadow-sm border ${
                    isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
                  }`}
                >
                  {/* Product Name */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {stock.productName}
                      </p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                        Taken on {stock.takenAt?.toDate().toLocaleDateString('en-IN')}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                      remaining > 0
                        ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                        : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                    }`}>
                      {remaining > 0 ? `${remaining} Remaining` : 'All Returned'}
                    </span>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className={`rounded-xl p-2 text-center ${
                      isDark ? 'bg-blue-500/10' : 'bg-blue-50'
                    }`}>
                      <p className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {stock.takenQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-blue-300/60' : 'text-blue-600/60'}`}>
                        Taken
                      </p>
                    </div>
                    <div className={`rounded-xl p-2 text-center ${
                      isDark ? 'bg-green-500/10' : 'bg-green-50'
                    }`}>
                      <p className={`text-lg font-black ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                        {stock.usedQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-green-300/60' : 'text-green-600/60'}`}>
                        Used
                      </p>
                    </div>
                    <div className={`rounded-xl p-2 text-center ${
                      isDark ? 'bg-purple-500/10' : 'bg-purple-50'
                    }`}>
                      <p className={`text-lg font-black ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        {stock.returnedQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-purple-300/60' : 'text-purple-600/60'}`}>
                        Returned
                      </p>
                    </div>
                  </div>

                  {remaining > 0 && (
                    <>
                      {/* Return Form */}
                      <div className="grid grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className={`text-xs font-bold block mb-2 ${
                            isDark ? 'text-cyan-300' : 'text-cyan-600'
                          }`}>
                            ↩ Return to Company
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={data.returning}
                            onChange={e => handleReturnChange(stock.id, 'returning', e.target.value)}
                            className={`w-full border rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 transition ${
                              isDark
                                ? 'bg-white/5 border-cyan-500/30 text-cyan-300 focus:ring-cyan-500'
                                : 'border-cyan-200 text-cyan-700 focus:ring-cyan-300'
                            }`}
                          />
                        </div>
                        <div>
                          <label className={`text-xs font-bold block mb-2 ${
                            isDark ? 'text-red-300' : 'text-red-600'
                          }`}>
                            ✕ Mark as Damaged
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={remaining}
                            value={data.damaged}
                            onChange={e => handleReturnChange(stock.id, 'damaged', e.target.value)}
                            className={`w-full border rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 transition ${
                              isDark
                                ? 'bg-white/5 border-red-500/30 text-red-300 focus:ring-red-500'
                                : 'border-red-200 text-red-700 focus:ring-red-300'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Return Button */}
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleReturnStock(stock.id)}
                        disabled={saving || (data.returning === 0 && data.damaged === 0)}
                        className={`w-full rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-40 ${
                          isDark
                            ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                            : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-md'
                        }`}
                      >
                        {saving ? '⏳ Processing...' : '✅ Confirm Return'}
                      </motion.button>
                    </>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
