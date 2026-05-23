import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, addDoc, serverTimestamp } from 'firebase/firestore'
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
  const directTotalReturned = directStock.reduce((sum, s) => sum + s.returnedQuantity, 0)
  const directRemaining = directStock.reduce((sum, s) => sum + (s.takenQuantity - s.usedQuantity - s.returnedQuantity - (s.damagedQuantity || 0)), 0)
  
  const jobAssignments = []
  const jobTotalAssigned = 0
  const jobTotalUsed = 0

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>My Stock</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          Products currently assigned to you
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/technician/take-stock')}
          className={`rounded-2xl p-5 text-left shadow-sm border transition group ${
            isDark
              ? 'bg-gradient-to-br from-cyan-500/10 to-cyan-600/10 border-cyan-500/30 hover:border-cyan-500/50'
              : 'bg-gradient-to-br from-cyan-50 to-cyan-100 border-cyan-200 hover:border-cyan-400 hover:shadow-md'
          }`}
        >
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition ${
              isDark
                ? 'bg-cyan-500/20 group-hover:bg-cyan-500/30'
                : 'bg-cyan-200 group-hover:bg-cyan-300'
            }`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            <div className="flex-1">
              <p className={`font-black text-base mb-1 ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                Take Stock
              </p>
              <p className={`text-xs ${isDark ? 'text-cyan-300/70' : 'text-cyan-600'}`}>
                Request products from company inventory
              </p>
            </div>
            <svg className={`w-5 h-5 transition ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
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
            { label: 'Taken', value: directTotalTaken, icon: 'M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4', color: 'blue' },
            { label: 'Used', value: directTotalUsed, icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'green' },
            { label: 'Returned', value: directTotalReturned, icon: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6', color: 'purple' },
            { label: 'Remaining', value: directRemaining, icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4', color: 'amber' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 shadow-sm border ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <svg className={`w-4 h-4 ${
                  stat.color === 'blue' ? isDark ? 'text-blue-400' : 'text-blue-600' :
                  stat.color === 'green' ? isDark ? 'text-green-400' : 'text-green-600' :
                  stat.color === 'purple' ? isDark ? 'text-purple-400' : 'text-purple-600' :
                  isDark ? 'text-amber-400' : 'text-amber-600'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={stat.icon} />
                </svg>
              </div>
              <p className={`text-2xl font-black mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stat.value}
              </p>
              <p className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
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
            {directStock.map(a => {
              const remaining = a.takenQuantity - a.usedQuantity - a.returnedQuantity
              // Get real-time product data
              const product = products.find(p => p.id === a.productId)
              const productName = product?.name || a.productName
              const productPrice = product?.price || a.productPrice
              const productCategory = product?.category || 'Uncategorized'
              
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 shadow-sm border ${
                    isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      isDark ? 'bg-blue-500/20' : 'bg-blue-100'
                    }`}>
                      <svg className={`w-4 h-4 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {productName}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                          {productCategory}
                        </span>
                        {productPrice > 0 && (
                          <>
                            <span className={`text-xs ${isDark ? 'text-white/30' : 'text-gray-300'}`}>•</span>
                            <span className={`text-xs font-semibold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                              ₹{productPrice.toLocaleString('en-IN')}/unit
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className={`rounded-xl p-3 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                      <p className={`text-xl font-black mb-1 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {a.takenQuantity}
                      </p>
                      <p className={`text-xs font-medium ${isDark ? 'text-blue-300/70' : 'text-blue-600/70'}`}>
                        Taken
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                      <p className={`text-xl font-black mb-1 ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                        {a.usedQuantity}
                      </p>
                      <p className={`text-xs font-medium ${isDark ? 'text-green-300/70' : 'text-green-600/70'}`}>
                        Used
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                      <p className={`text-xl font-black mb-1 ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        {a.returnedQuantity}
                      </p>
                      <p className={`text-xs font-medium ${isDark ? 'text-purple-300/70' : 'text-purple-600/70'}`}>
                        Returned
                      </p>
                    </div>
                    <div className={`rounded-xl p-3 ${
                      remaining > 0
                        ? isDark ? 'bg-amber-500/10' : 'bg-amber-50'
                        : isDark ? 'bg-gray-500/10' : 'bg-gray-50'
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
                    </div>
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