import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, addDoc, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

export default function MyStock() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [directStock, setDirectStock] = useState([])
  const [products, setProducts] = useState([])
  const [markDamageModal, setMarkDamageModal] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null)
  const [damageQty, setDamageQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [drillModal, setDrillModal] = useState(null) // { type, productId, productName, remaining }
  const [drillData, setDrillData] = useState([])
  const [drillLoading, setDrillLoading] = useState(false)

  // Load products from inventory for real-time updates
  useEffect(() => {
    return onSnapshot(collection(db, 'inventory'), snap => {
      const invProds = snap.docs.map(d => ({ 
        id: d.id, 
        name: d.data().productName || d.data().name, 
        price: d.data().price,
        category: d.data().category,
        quantity: d.data().quantity,
        ...d.data() 
      }))
      setProducts(invProds)
    })
  }, [])

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'technician_stock'), where('technicianId', '==', user.uid), where('status', '==', 'active')),
      snap => setDirectStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
  }, [user])

  const handleMarkDamage = async () => {
    if (!selectedStock || !damageQty) {
      toast.error('Enter damage quantity')
      return
    }

    const qty = Number(damageQty)
    const remaining = selectedStock.takenQuantity - selectedStock.usedQuantity - selectedStock.returnedQuantity - selectedStock.damagedQuantity

    if (qty <= 0 || qty > remaining) {
      toast.error(`Invalid quantity. Available: ${remaining}`)
      return
    }

    setSaving(true)
    try {
      const damageCharge = qty * (selectedStock.productPrice || 0)
      
      await updateDoc(doc(db, 'technician_stock', selectedStock.id), {
        damagedQuantity: selectedStock.damagedQuantity + qty,
        damageCharges: (selectedStock.damageCharges || 0) + damageCharge,
        lastUpdated: serverTimestamp(),
      })

      // Log damage transaction
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'damaged',
        productId: selectedStock.productId,
        productName: selectedStock.productName,
        quantity: qty,
        damageCharge: damageCharge,
        fromUser: user.displayName || 'Technician',
        technicianId: user.uid,
        timestamp: serverTimestamp(),
      })

      toast.success(`✅ ${qty} item(s) marked as damaged. Charge: ₹${damageCharge}`)
      setMarkDamageModal(false)
      setSelectedStock(null)
      setDamageQty('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const directTotalTaken = directStock.reduce((sum, s) => sum + s.takenQuantity, 0)
  const directTotalUsed = directStock.reduce((sum, s) => sum + s.usedQuantity, 0)
  const openDrill = async (type, stock) => {
    setDrillModal({ type, productId: stock.productId, productName: stock.productName, remaining: stock.takenQuantity - stock.usedQuantity - (stock.returnedQuantity || 0) - (stock.damagedQuantity || 0) })
    setDrillData([])
    setDrillLoading(true)
    try {
      if (type === 'Taken') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'technician_take'), where('technicianId', '==', user.uid), where('productId', '==', stock.productId)))
        const rows = snap.docs.map(d => ({ qty: d.data().quantity, ts: d.data().timestamp }))
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      } else if (type === 'Used') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'job_usage'), where('productId', '==', stock.productId)))
        let rows = snap.docs
          .filter(d => !d.data().technicianId || d.data().technicianId === user.uid)
          .map(d => ({ qty: d.data().usedQuantity || d.data().quantity || 0, ts: d.data().timestamp, label: d.data().customerName || d.data().jobId || '' }))
        if (rows.length === 0) {
          const snap2 = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'job_usage'), where('productName', '==', stock.productName)))
          rows = snap2.docs
            .filter(d => !d.data().technicianId || d.data().technicianId === user.uid)
            .map(d => ({ qty: d.data().usedQuantity || d.data().quantity || 0, ts: d.data().timestamp, label: d.data().customerName || d.data().jobId || '' }))
        }
        // If still no records but usedQuantity > 0, show legacy entry
        if (rows.length === 0 && (stock.usedQuantity || 0) > 0) {
          rows = [{ qty: stock.usedQuantity, ts: stock.lastUpdated || stock.takenAt, legacy: true }]
        }
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      } else if (type === 'Damaged') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'damaged'), where('productId', '==', stock.productId)))
        let rows = snap.docs
          .filter(d => !d.data().technicianId || d.data().technicianId === user.uid)
          .map(d => ({ qty: d.data().quantity, ts: d.data().timestamp, charge: d.data().damageCharge }))
        if (rows.length === 0) {
          const snap2 = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'damaged'), where('productName', '==', stock.productName)))
          rows = snap2.docs
            .filter(d => !d.data().technicianId || d.data().technicianId === user.uid)
            .map(d => ({ qty: d.data().quantity, ts: d.data().timestamp, charge: d.data().damageCharge }))
        }
        // If still no records but damagedQuantity > 0, show legacy entry
        if (rows.length === 0 && (stock.damagedQuantity || 0) > 0) {
          rows = [{ qty: stock.damagedQuantity, ts: stock.lastUpdated || stock.takenAt, charge: stock.damageCharges || 0, legacy: true }]
        }
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      }
    } catch (e) {
      toast.error('Failed to load details')
    } finally {
      setDrillLoading(false)
    }
  }

  const fmtDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const directTotalDamaged = directStock.reduce((sum, s) => sum + (s.damagedQuantity || 0), 0)
  const directRemaining = directStock.reduce((sum, s) => sum + (s.takenQuantity - s.usedQuantity - (s.returnedQuantity || 0) - (s.damagedQuantity || 0)), 0)
  
  const jobAssignments = []
  const jobTotalAssigned = 0
  const jobTotalUsed = 0

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>My Stock</h2>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/technician/take-stock')}
          className={`px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 ${
            isDark
              ? 'bg-blue-600 text-white border border-blue-500 hover:bg-blue-700 shadow-lg shadow-blue-500/40'
              : 'bg-blue-600 text-white border border-blue-700 hover:bg-blue-700 shadow-lg shadow-blue-400/50'
          }`}
        >
          Take Stock
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>

      {/* Direct Stock Stats */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <svg className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
            Stock Summary
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Taken', value: directTotalTaken, color: 'blue' },
            { label: 'Used', value: directTotalUsed, color: 'green' },
            { label: 'Damaged', value: directTotalDamaged, color: 'red' },
            { label: 'Remaining', value: directRemaining, color: 'amber' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 shadow-sm border ${
                stat.color === 'blue' ? isDark ? 'bg-blue-500/20 border-blue-500/30' : 'bg-blue-100 border-blue-200' :
                stat.color === 'green' ? isDark ? 'bg-green-500/20 border-green-500/30' : 'bg-green-100 border-green-200' :
                stat.color === 'red' ? isDark ? 'bg-red-500/20 border-red-500/30' : 'bg-red-100 border-red-200' :
                isDark ? 'bg-amber-500/20 border-amber-500/30' : 'bg-amber-100 border-amber-200'
              }`}
            >
              <p className={`text-2xl font-black mb-1 ${
                stat.color === 'blue' ? isDark ? 'text-blue-300' : 'text-blue-700' :
                stat.color === 'green' ? isDark ? 'text-green-300' : 'text-green-700' :
                stat.color === 'red' ? isDark ? 'text-red-300' : 'text-red-700' :
                isDark ? 'text-amber-300' : 'text-amber-700'
              }`}>
                {stat.value}
              </p>
              <p className={`text-xs font-medium ${
                stat.color === 'blue' ? isDark ? 'text-blue-400' : 'text-blue-600' :
                stat.color === 'green' ? isDark ? 'text-green-400' : 'text-green-600' :
                stat.color === 'red' ? isDark ? 'text-red-400' : 'text-red-600' :
                isDark ? 'text-amber-400' : 'text-amber-600'
              }`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Stock Items */}
      {directStock.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <svg className={`w-4 h-4 ${isDark ? 'text-white/40' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
              Stock Items
            </p>
          </div>
          <div className="grid gap-3">
            {[...directStock].sort((a, b) => {
              const remA = a.takenQuantity - a.usedQuantity - (a.returnedQuantity || 0) - (a.damagedQuantity || 0)
              const remB = b.takenQuantity - b.usedQuantity - (b.returnedQuantity || 0) - (b.damagedQuantity || 0)
              return remB - remA
            }).map(a => {
              const remaining = a.takenQuantity - a.usedQuantity - (a.returnedQuantity || 0) - (a.damagedQuantity || 0)
              // Get real-time product data
              const product = products.find(p => p.id === a.productId)
              const productName = product?.name || a.productName
              const productPrice = product?.price || a.productPrice
              const productCategory = product?.category || 'Uncategorized'
              
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 shadow-sm border ${
                    remaining === 0
                      ? isDark ? 'bg-gray-800/40 border-white/5' : 'bg-gray-100 border-gray-200'
                      : isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      remaining === 0
                        ? isDark ? 'bg-gray-500/20' : 'bg-gray-200'
                        : isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                      <svg className={`w-4 h-4 ${
                        remaining === 0
                          ? isDark ? 'text-gray-500' : 'text-gray-400'
                          : isDark ? 'text-blue-300' : 'text-blue-600'
                      }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${
                        remaining === 0
                          ? isDark ? 'text-gray-500' : 'text-gray-400'
                          : isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {productName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${
                          remaining === 0
                            ? isDark ? 'text-gray-600' : 'text-gray-400'
                            : isDark ? 'text-white/50' : 'text-gray-500'
                        }`}>
                          {productCategory}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <button onClick={() => openDrill('Taken', a)} className={`rounded-xl p-2 cursor-pointer active:scale-95 transition-transform ${
                      remaining === 0
                        ? isDark ? 'bg-gray-500/10 hover:bg-gray-500/20' : 'bg-gray-100 hover:bg-gray-200'
                        : isDark ? 'bg-blue-500/10 hover:bg-blue-500/20' : 'bg-blue-50 hover:bg-blue-100'
                    }`}>
                      <p className={`text-xl font-black mb-1 ${
                        remaining === 0
                          ? isDark ? 'text-gray-500' : 'text-gray-400'
                          : isDark ? 'text-blue-300' : 'text-blue-600'
                      }`}>
                        {a.takenQuantity}
                      </p>
                      <p className={`text-xs font-medium ${
                        remaining === 0
                          ? isDark ? 'text-gray-600' : 'text-gray-400'
                          : isDark ? 'text-blue-300/70' : 'text-blue-600/70'
                      }`}>
                        Taken
                      </p>
                    </button>
                    <button onClick={() => openDrill('Used', a)} className={`rounded-xl p-2 cursor-pointer active:scale-95 transition-transform ${
                      remaining === 0
                        ? isDark ? 'bg-gray-500/10 hover:bg-gray-500/20' : 'bg-gray-100 hover:bg-gray-200'
                        : isDark ? 'bg-green-500/10 hover:bg-green-500/20' : 'bg-green-50 hover:bg-green-100'
                    }`}>
                      <p className={`text-xl font-black mb-1 ${
                        remaining === 0
                          ? isDark ? 'text-gray-500' : 'text-gray-400'
                          : isDark ? 'text-green-300' : 'text-green-600'
                      }`}>
                        {a.usedQuantity}
                      </p>
                      <p className={`text-xs font-medium ${
                        remaining === 0
                          ? isDark ? 'text-gray-600' : 'text-gray-400'
                          : isDark ? 'text-green-300/70' : 'text-green-600/70'
                      }`}>
                        Used
                      </p>
                    </button>
                    <button onClick={() => openDrill('Damaged', a)} className={`rounded-xl p-2 cursor-pointer active:scale-95 transition-transform ${
                      remaining === 0
                        ? isDark ? 'bg-gray-500/10 hover:bg-gray-500/20' : 'bg-gray-100 hover:bg-gray-200'
                        : isDark ? 'bg-red-500/10 hover:bg-red-500/20' : 'bg-red-50 hover:bg-red-100'
                    }`}>
                      <p className={`text-xl font-black mb-1 ${
                        remaining === 0
                          ? isDark ? 'text-gray-500' : 'text-gray-400'
                          : isDark ? 'text-red-300' : 'text-red-600'
                      }`}>
                        {a.damagedQuantity || 0}
                      </p>
                      <p className={`text-xs font-medium ${
                        remaining === 0
                          ? isDark ? 'text-gray-600' : 'text-gray-400'
                          : isDark ? 'text-red-300/70' : 'text-red-600/70'
                      }`}>
                        Damaged
                      </p>
                    </button>
                    <button onClick={() => openDrill('Remaining', a)} className={`rounded-xl p-2 cursor-pointer active:scale-95 transition-transform ${
                      remaining > 0
                        ? isDark ? 'bg-amber-500/10 hover:bg-amber-500/20' : 'bg-amber-50 hover:bg-amber-100'
                        : isDark ? 'bg-gray-500/10 hover:bg-gray-500/20' : 'bg-gray-50 hover:bg-gray-100'
                    }`}>
                      <p className={`text-xl font-black mb-1 ${
                        remaining > 0
                          ? isDark ? 'text-amber-300' : 'text-amber-600'
                          : isDark ? 'text-gray-400' : 'text-gray-400'
                      }`}>
                        {remaining}
                      </p>
                      <p className={`text-xs font-medium ${
                        remaining > 0
                          ? isDark ? 'text-amber-300/70' : 'text-amber-600/70'
                          : isDark ? 'text-gray-400/70' : 'text-gray-400/70'
                      }`}>
                        Remaining
                      </p>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Job-Assigned Stock */}
      {jobAssignments.length > 0 && (
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
            Job-Assigned Stock
          </p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className={`rounded-xl p-3 shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}>
              <p className={`text-2xl font-black ${isDark ? 'text-cyan-400' : 'text-aqua-600'}`}>
                {jobTotalAssigned}
              </p>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                Total Assigned
              </p>
            </div>
            <div className={`rounded-xl p-3 shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}>
              <p className={`text-2xl font-black ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                {jobTotalUsed}
              </p>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                Total Used
              </p>
            </div>
          </div>

          <div className="grid gap-3">
            {jobAssignments.map(a => {
              const remaining = a.assignedQuantity - a.usedQuantity - a.returnedQuantity
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}
                >
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {a.productName}
                  </p>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <div className={`rounded-xl p-2 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                      <p className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {a.assignedQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-blue-300/60' : 'text-blue-600/60'}`}>
                        Assigned
                      </p>
                    </div>
                    <div className={`rounded-xl p-2 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                      <p className={`text-lg font-black ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                        {a.usedQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-green-300/60' : 'text-green-600/60'}`}>
                        Used
                      </p>
                    </div>
                    <div className={`rounded-xl p-2 ${
                      remaining > 0
                        ? isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                        : isDark ? 'bg-gray-500/10' : 'bg-gray-50'
                    }`}>
                      <p className={`text-lg font-black ${
                        remaining > 0
                          ? isDark ? 'text-amber-300' : 'text-amber-600'
                          : isDark ? 'text-gray-400' : 'text-gray-400'
                      }`}>
                        {remaining}
                      </p>
                      <p className={`text-xs ${
                        remaining > 0
                          ? isDark ? 'text-amber-300/60' : 'text-amber-600/60'
                          : isDark ? 'text-gray-400/60' : 'text-gray-400/60'
                      }`}>
                        Remaining
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Drill-down Modal */}
      <AnimatePresence>
        {drillModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDrillModal(null)}>
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              onClick={e => e.stopPropagation()}
              className={`relative w-full max-w-sm rounded-2xl shadow-xl border overflow-hidden ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
              }`}
            >
              {/* Modal Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-white/10' : 'border-gray-100'
              }`}>
                <div>
                  <p className={`font-black text-base ${
                    drillModal.type === 'Taken' ? isDark ? 'text-blue-300' : 'text-blue-600' :
                    drillModal.type === 'Used' ? isDark ? 'text-green-300' : 'text-green-600' :
                    drillModal.type === 'Damaged' ? isDark ? 'text-red-300' : 'text-red-600' :
                    isDark ? 'text-amber-300' : 'text-amber-600'
                  }`}>{drillModal.type} History</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{drillModal.productName}</p>
                </div>
                <button onClick={() => setDrillModal(null)} className={`w-7 h-7 rounded-full flex items-center justify-center ${
                  isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-2">
                {drillModal.type === 'Remaining' ? (
                  <div className="text-center py-6">
                    <p className={`text-4xl font-black mb-1 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{drillModal.remaining}</p>
                    <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>units currently with you</p>
                  </div>
                ) : drillLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
                  </div>
                ) : drillData.length === 0 ? (
                  <p className={`text-center py-8 text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>No records found</p>
                ) : (
                  drillData.map((row, i) => (
                    <div key={i} className={`rounded-xl px-3 py-3 ${
                      isDark ? 'bg-white/5' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg ${
                          drillModal.type === 'Taken' ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700' :
                          drillModal.type === 'Used' ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' :
                          isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                        }`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {fmtDate(row.ts)}
                        </div>
                        <span className={`text-xl font-black ${
                          drillModal.type === 'Taken' ? isDark ? 'text-blue-300' : 'text-blue-600' :
                          drillModal.type === 'Used' ? isDark ? 'text-green-300' : 'text-green-600' :
                          isDark ? 'text-red-300' : 'text-red-600'
                        }`}>{row.qty} <span className="text-xs font-medium opacity-60">units</span></span>
                      </div>
                      {row.label && <p className={`text-xs mt-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>Job: {row.label}</p>}
                      {row.legacy && <p className={`text-xs mt-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>Recorded before history tracking</p>}
                      {row.charge > 0 && <p className={`text-xs mt-1 font-semibold ${isDark ? 'text-red-300/70' : 'text-red-500'}`}>Charge: ₹{row.charge}</p>}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {jobAssignments.length === 0 && directStock.length === 0 && (
        <div className={`rounded-2xl p-12 text-center shadow-sm border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}>
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center ${
            isDark ? 'bg-gray-500/10' : 'bg-gray-100'
          }`}>
            <svg className={`w-8 h-8 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <p className={`font-bold text-base mb-2 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            No stock assigned to you currently
          </p>
          <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Use "Take Stock" to request products from company inventory
          </p>
        </div>
      )}
    </div>
  )
}