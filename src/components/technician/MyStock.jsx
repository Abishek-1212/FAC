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
  const [markDamageModal, setMarkDamageModal] = useState(false)
  const [selectedStock, setSelectedStock] = useState(null)
  const [damageQty, setDamageQty] = useState('')
  const [saving, setSaving] = useState(false)

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
      <div className="grid grid-cols-2 gap-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/technician/take-stock')}
          className={`rounded-2xl p-4 text-left shadow-sm border transition ${
            isDark
              ? 'bg-dark-card border-white/10 hover:border-cyan-500/30'
              : 'bg-white border-gray-100 hover:border-aqua-300 hover:shadow-md'
          }`}
        >
          <span className="text-2xl">📤</span>
          <p className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Take Stock
          </p>
          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            From company
          </p>
        </motion.button>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/technician/return-stock')}
          className={`rounded-2xl p-4 text-left shadow-sm border transition ${
            isDark
              ? 'bg-dark-card border-white/10 hover:border-cyan-500/30'
              : 'bg-white border-gray-100 hover:border-aqua-300 hover:shadow-md'
          }`}
        >
          <span className="text-2xl">↩️</span>
          <p className={`font-bold text-sm mt-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Return Stock
          </p>
          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Unused items
          </p>
        </motion.button>
      </div>

      {/* Direct Stock Stats */}
      <div>
        <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          My Personal Stock
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Taken', value: directTotalTaken, color: 'blue' },
            { label: 'Used', value: directTotalUsed, color: 'green' },
            { label: 'Returned', value: directTotalReturned, color: 'purple' },
            { label: 'Remaining', value: directRemaining, color: 'amber' },
          ].map((stat, i) => (
            <div
              key={i}
              className={`rounded-xl p-3 shadow-sm border ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
              }`}
            >
              <p className={`text-xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                {stat.value}
              </p>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Direct Stock Items */}
      {directStock.length > 0 && (
        <div>
          <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
            Personal Stock Items
          </p>
          <div className="grid gap-3">
            {directStock.map(a => {
              const remaining = a.takenQuantity - a.usedQuantity - a.returnedQuantity
              return (
                <div
                  key={a.id}
                  className={`rounded-2xl p-4 shadow-sm border ${
                    isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
                  }`}
                >
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {a.productName}
                  </p>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                    <div className={`rounded-xl p-2 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                      <p className={`text-lg font-black ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                        {a.takenQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-blue-300/60' : 'text-blue-600/60'}`}>
                        Taken
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
                    <div className={`rounded-xl p-2 ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                      <p className={`text-lg font-black ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>
                        {a.returnedQuantity}
                      </p>
                      <p className={`text-xs ${isDark ? 'text-purple-300/60' : 'text-purple-600/60'}`}>
                        Returned
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
          <p className="text-4xl mb-3">📦</p>
          <p className={`font-medium mb-2 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            No stock assigned to you currently
          </p>
          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Use "Take Stock" to get products from company inventory
          </p>
        </div>
      )}
    </div>
  )
}