import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function VerifyStock() {
  const { isDark } = useTheme()
  const [technicians, setTechnicians] = useState([])
  const [selectedTech, setSelectedTech] = useState('')
  const [techStock, setTechStock] = useState([])
  const [products, setProducts] = useState([])
  const [verifying, setVerifying] = useState(false)
  const [showReturnModal, setShowReturnModal] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null)
  const [returnQuantity, setReturnQuantity] = useState('')

  useEffect(() => {
    const unsubs = []
    
    // Load technicians
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))
    
    // Load products for category info
    unsubs.push(onSnapshot(collection(db, 'products'), snap => 
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))
    
    return () => unsubs.forEach(u => u())
  }, [])

  useEffect(() => {
    if (!selectedTech) {
      setTechStock([])
      return
    }
    
    console.log('Loading stock for technician:', selectedTech)
    
    const unsub = onSnapshot(
      query(collection(db, 'technician_stock'), where('technicianId', '==', selectedTech)),
      snap => {
        const stock = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        console.log('Technician stock loaded:', stock)
        setTechStock(stock)
      },
      err => {
        console.error('Error loading technician stock:', err)
        toast.error('Error loading stock data')
      }
    )
    
    return unsub
  }, [selectedTech])

  const openReturnModal = (stockItem) => {
    const remaining = stockItem.takenQuantity - stockItem.usedQuantity - stockItem.returnedQuantity - (stockItem.damagedQuantity || 0)
    
    if (remaining <= 0) {
      toast.error('No items to return')
      return
    }
    
    setSelectedStock(stockItem)
    setReturnQuantity(remaining.toString())
    setShowReturnModal(true)
  }

  const handleVerifyReturn = async () => {
    const remaining = selectedStock.takenQuantity - selectedStock.usedQuantity - selectedStock.returnedQuantity - (selectedStock.damagedQuantity || 0)
    
    const qty = parseInt(returnQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error('Invalid quantity')
      return
    }
    
    if (qty > remaining) {
      toast.error(`Cannot return more than ${remaining} items`)
      return
    }

    setVerifying(true)
    try {
      const newReturned = selectedStock.returnedQuantity + qty
      const newPending = selectedStock.takenQuantity - selectedStock.usedQuantity - newReturned - (selectedStock.damagedQuantity || 0)
      
      // Check if everything is cleared (no pending and no damaged)
      const shouldDelete = newPending === 0 && (selectedStock.damagedQuantity || 0) === 0
      
      // Log transaction first
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'return_verified',
        technicianId: selectedStock.technicianId,
        technicianName: selectedStock.technicianName,
        productId: selectedStock.productId,
        productName: selectedStock.productName,
        quantity: qty,
        timestamp: serverTimestamp(),
      })
      
      if (shouldDelete) {
        // Delete the stock record completely
        await deleteDoc(doc(db, 'technician_stock', selectedStock.id))
        toast.success(`✅ Verified return of ${qty} units of ${selectedStock.productName} - Stock record removed`)
      } else {
        // Just update returned quantity
        await updateDoc(doc(db, 'technician_stock', selectedStock.id), {
          returnedQuantity: newReturned,
          lastUpdated: serverTimestamp(),
        })
        toast.success(`✅ Verified return of ${qty} units of ${selectedStock.productName}`)
      }

      setShowReturnModal(false)
      setReturnQuantity('')
      setSelectedStock(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleClearPending = async (stockItem) => {
    const pending = stockItem.takenQuantity - stockItem.usedQuantity - stockItem.returnedQuantity - (stockItem.damagedQuantity || 0)
    
    if (pending <= 0) {
      toast.error('No pending items')
      return
    }

    if (!confirm(`Clear ${pending} pending units? This will mark them as returned.`)) return

    setVerifying(true)
    try {
      const newReturned = stockItem.returnedQuantity + pending
      const newPending = stockItem.takenQuantity - stockItem.usedQuantity - newReturned - (stockItem.damagedQuantity || 0)
      
      // Check if everything is cleared (no pending and no damaged)
      const shouldDelete = newPending === 0 && (stockItem.damagedQuantity || 0) === 0
      
      // Log transaction first
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'pending_cleared',
        technicianId: stockItem.technicianId,
        technicianName: stockItem.technicianName,
        productId: stockItem.productId,
        productName: stockItem.productName,
        quantity: pending,
        timestamp: serverTimestamp(),
      })
      
      if (shouldDelete) {
        // Delete the stock record completely
        await deleteDoc(doc(db, 'technician_stock', stockItem.id))
        toast.success(`✅ Cleared ${pending} pending units of ${stockItem.productName} - Stock record removed`)
      } else {
        // Just update returned quantity
        await updateDoc(doc(db, 'technician_stock', stockItem.id), {
          returnedQuantity: newReturned,
          lastUpdated: serverTimestamp(),
        })
        toast.success(`✅ Cleared ${pending} pending units of ${stockItem.productName}`)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleClearDamaged = async (stockItem) => {
    const damaged = stockItem.damagedQuantity || 0
    
    if (damaged <= 0) {
      toast.error('No damaged items')
      return
    }

    if (!confirm(`Clear ${damaged} damaged units? This will remove them from tracking.`)) return

    setVerifying(true)
    try {
      const pending = stockItem.takenQuantity - stockItem.usedQuantity - stockItem.returnedQuantity - damaged
      
      // Check if everything is cleared (no pending and clearing damaged)
      const shouldDelete = pending === 0
      
      // Log transaction first
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'damaged_cleared',
        technicianId: stockItem.technicianId,
        technicianName: stockItem.technicianName,
        productId: stockItem.productId,
        productName: stockItem.productName,
        quantity: damaged,
        timestamp: serverTimestamp(),
      })
      
      if (shouldDelete) {
        // Delete the stock record completely
        await deleteDoc(doc(db, 'technician_stock', stockItem.id))
        toast.success(`✅ Cleared ${damaged} damaged units of ${stockItem.productName} - Stock record removed`)
      } else {
        // Just clear damaged
        await updateDoc(doc(db, 'technician_stock', stockItem.id), {
          damagedQuantity: 0,
          damageCharges: 0,
          lastUpdated: serverTimestamp(),
        })
        toast.success(`✅ Cleared ${damaged} damaged units of ${stockItem.productName}`)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const handleResetStock = async (stockItem) => {
    if (!confirm(`Remove stock record for ${stockItem.productName}? This will delete it completely.`)) return

    setVerifying(true)
    try {
      // Log transaction first
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'stock_reset',
        technicianId: stockItem.technicianId,
        technicianName: stockItem.technicianName,
        productId: stockItem.productId,
        productName: stockItem.productName,
        timestamp: serverTimestamp(),
      })
      
      // Delete the stock record
      await deleteDoc(doc(db, 'technician_stock', stockItem.id))

      toast.success(`✅ Stock record removed for ${stockItem.productName}`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  const selectedTechData = technicians.find(t => t.id === selectedTech)

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Verify Stock Returns</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          Verify technician stock returns and clear pending/damaged items
        </p>
      </div>

      {/* Select Technician */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 shadow-sm border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
        }`}
      >
        <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
          isDark ? 'text-white/60' : 'text-gray-500'
        }`}>
          Select Technician
        </label>
        <select
          value={selectedTech}
          onChange={e => setSelectedTech(e.target.value)}
          className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
            isDark
              ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
              : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
          }`}
        >
          <option value="" className="text-gray-900">Choose a technician...</option>
          {technicians.map(tech => (
            <option key={tech.id} value={tech.id} className="text-gray-900">
              {tech.name} - {tech.phone || tech.phoneNumber}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Technician Stock */}
      {selectedTech && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl overflow-hidden shadow-sm border ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
          }`}
        >
          <div className={`px-5 py-4 border-b ${
            isDark
              ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border-white/10'
              : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-gray-100'
          }`}>
            <h3 className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              📦 {selectedTechData?.name}'s Stock
            </h3>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
              Items currently in possession
            </p>
          </div>

          {techStock.length === 0 ? (
            <div className="p-8 text-center">
              <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                No active stock for this technician
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {techStock.map((stock, idx) => {
                const taken = stock.takenQuantity || 0
                const used = stock.usedQuantity || 0
                const returned = stock.returnedQuantity || 0
                const damaged = stock.damagedQuantity || 0
                const pending = taken - used - returned - damaged
                const product = products.find(p => p.id === stock.productId)

                return (
                  <motion.div
                    key={stock.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl p-4 border ${
                      isDark
                        ? 'bg-white/5 border-white/10'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Product Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {stock.productName}
                        </p>
                        {product?.category && (
                          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                            {product.category}
                          </p>
                        )}
                      </div>
                      {pending > 0 && (
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                          isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {pending} pending
                        </span>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: 'Taken', value: taken, color: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700' },
                        { label: 'Used', value: used, color: isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-700' },
                        { label: 'Returned', value: returned, color: isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-50 text-purple-700' },
                        { label: 'Damaged', value: damaged, color: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-700' },
                      ].map(stat => (
                        <div key={stat.label} className={`text-center p-2 rounded-lg ${stat.color}`}>
                          <p className="text-base font-black">{stat.value}</p>
                          <p className="text-[9px] font-semibold opacity-70">{stat.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {pending > 0 && (
                        <>
                          <button
                            onClick={() => openReturnModal(stock)}
                            disabled={verifying}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                              isDark
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            } disabled:opacity-50`}
                          >
                            ✅ Verify Return ({pending})
                          </button>
                          <button
                            onClick={() => handleClearPending(stock)}
                            disabled={verifying}
                            className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                              isDark
                                ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                            } disabled:opacity-50`}
                          >
                            Clear Pending
                          </button>
                        </>
                      )}
                      {damaged > 0 && (
                        <button
                          onClick={() => handleClearDamaged(stock)}
                          disabled={verifying}
                          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                            isDark
                              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                              : 'bg-red-50 text-red-700 hover:bg-red-100'
                          } disabled:opacity-50`}
                        >
                          Clear Damaged ({damaged})
                        </button>
                      )}
                      {pending === 0 && damaged === 0 && (
                        <button
                          onClick={() => handleResetStock(stock)}
                          disabled={verifying}
                          className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                            isDark
                              ? 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          } disabled:opacity-50`}
                        >
                          🔄 Reset Stock
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Info Card */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className={`rounded-2xl p-4 border ${
          isDark
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-blue-50 border-blue-200'
        }`}
      >
        <p className={`text-sm font-bold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
          ℹ️ How it works
        </p>
        <ul className={`text-xs space-y-1 ${isDark ? 'text-blue-300/80' : 'text-blue-600'}`}>
          <li>• <span className="font-bold">Verify Return:</span> Confirms technician returned all pending items</li>
          <li>• <span className="font-bold">Clear Pending:</span> Removes pending items (e.g., after receiving payment)</li>
          <li>• <span className="font-bold">Clear Damaged:</span> Removes damaged items from tracking (after resolution)</li>
        </ul>
      </motion.div>

      {/* Return Verification Modal */}
      {showReturnModal && selectedStock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${
              isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
            }`}
          >
            {/* Header */}
            <div className={`px-6 py-4 border-b ${
              isDark
                ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-white/10'
                : 'bg-gradient-to-r from-emerald-50 to-green-50 border-gray-100'
            }`}>
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ✅ Verify Stock Return
              </h3>
              <p className={`text-xs mt-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                {selectedStock.productName}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Stats */}
              <div className={`rounded-xl p-4 ${
                isDark ? 'bg-white/5' : 'bg-gray-50'
              }`}>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      Pending
                    </p>
                    <p className={`text-2xl font-black ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                      {selectedStock.takenQuantity - selectedStock.usedQuantity - selectedStock.returnedQuantity - (selectedStock.damagedQuantity || 0)}
                    </p>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                      Already Returned
                    </p>
                    <p className={`text-2xl font-black ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                      {selectedStock.returnedQuantity}
                    </p>
                  </div>
                </div>
              </div>

              {/* Input */}
              <div>
                <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                  isDark ? 'text-white/60' : 'text-gray-500'
                }`}>
                  Quantity Returned
                </label>
                <input
                  type="number"
                  value={returnQuantity}
                  onChange={e => setReturnQuantity(e.target.value)}
                  min="1"
                  max={selectedStock.takenQuantity - selectedStock.usedQuantity - selectedStock.returnedQuantity - (selectedStock.damagedQuantity || 0)}
                  className={`w-full border rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none focus:ring-2 transition ${
                    isDark
                      ? 'bg-white/5 border-white/10 text-white focus:ring-emerald-500'
                      : 'bg-white border-gray-200 text-gray-900 focus:ring-emerald-300'
                  }`}
                  autoFocus
                />
                <p className={`text-xs mt-2 text-center ${
                  isDark ? 'text-white/40' : 'text-gray-500'
                }`}>
                  Max: {selectedStock.takenQuantity - selectedStock.usedQuantity - selectedStock.returnedQuantity - (selectedStock.damagedQuantity || 0)} units
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex gap-3 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'
            }`}>
              <button
                onClick={() => {
                  setShowReturnModal(false)
                  setReturnQuantity('')
                  setSelectedStock(null)
                }}
                disabled={verifying}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                  isDark
                    ? 'bg-white/5 text-white/60 hover:bg-white/10'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyReturn}
                disabled={verifying || !returnQuantity}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                  isDark
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                    : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:from-emerald-600 hover:to-green-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {verifying ? 'Verifying...' : '✅ Verify Return'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
