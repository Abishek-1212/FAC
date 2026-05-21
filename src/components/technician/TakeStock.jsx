import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

const EMPTY_ITEM = { productId: '', quantity: '' }

export default function TakeStock() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const [products, setProducts] = useState([])
  const [items, setItems] = useState([{ ...EMPTY_ITEM }])
  const [saving, setSaving] = useState(false)
  const [technicianStock, setTechnicianStock] = useState([])
  const MAX_PER_PRODUCT = 20

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'products'), snap =>
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    
    // Get technician's current stock to check limits
    if (user) {
      const u2 = onSnapshot(
        query(collection(db, 'technician_stock'), where('technicianId', '==', user.uid), where('status', '==', 'active')),
        snap => setTechnicianStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
      return () => { u1(); u2() }
    }
    return () => { u1() }
  }, [user])

  const addRow = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeRow = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateRow = (i, key, val) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  const handleTakeStock = async (e) => {
    e.preventDefault()

    // Validate
    for (const row of items) {
      if (!row.productId || !row.quantity) {
        toast.error('Fill in all product rows or remove empty ones')
        return
      }
      if (Number(row.quantity) <= 0) {
        toast.error('Quantity must be greater than 0')
        return
      }

      // Check technician limit (max 20 per product)
      const existingStock = technicianStock.find(s => s.productId === row.productId)
      const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - existingStock.damagedQuantity) : 0
      const requestedQty = Number(row.quantity)
      
      if (currentHolding + requestedQty > MAX_PER_PRODUCT) {
        const product = products.find(p => p.id === row.productId)
        toast.error(`Limit exceeded for "${product.name}". You currently have ${currentHolding}. Max allowed: ${MAX_PER_PRODUCT} per product.`)
        return
      }
    }

    // Check duplicates
    const ids = items.map(r => r.productId)
    if (new Set(ids).size !== ids.length) {
      toast.error('Duplicate products in list. Combine them into one row.')
      return
    }

    setSaving(true)
    try {
      for (const row of items) {
        const qty = Number(row.quantity)
        const product = products.find(i => i.id === row.productId)

        // Get or create inventory record
        const invRef = doc(db, 'inventory', row.productId)
        const invSnap = await getDoc(invRef)
        
        let currentQty = 0
        if (invSnap.exists()) {
          currentQty = invSnap.data().quantity || 0
        }

        // Check if sufficient stock available
        if (currentQty < qty) {
          toast.error(`Insufficient stock for "${product.name}". Available: ${currentQty}. Please contact admin.`)
          setSaving(false)
          return
        }

        // Check if stock is low (less than 10) and notify
        const remainingAfterTake = currentQty - qty
        if (remainingAfterTake < 10 && remainingAfterTake > 0) {
          // Create low stock notification for admin
          await addDoc(collection(db, 'notifications'), {
            type: 'low_stock',
            productId: row.productId,
            productName: product.name,
            remainingQuantity: remainingAfterTake,
            message: `Low stock alert: ${product.name} has only ${remainingAfterTake} units remaining`,
            createdAt: serverTimestamp(),
            read: false,
          })
        }

        // Deduct from company inventory
        await updateDoc(invRef, {
          quantity: currentQty - qty,
          lastUpdated: serverTimestamp(),
        })

        // Check if technician already has this product
        const existingStock = technicianStock.find(s => s.productId === row.productId)
        
        if (existingStock) {
          // Update existing stock record
          await updateDoc(doc(db, 'technician_stock', existingStock.id), {
            takenQuantity: existingStock.takenQuantity + qty,
            lastTakenAt: serverTimestamp(),
          })
        } else {
          // Create new technician stock record
          await addDoc(collection(db, 'technician_stock'), {
            technicianId: user.uid,
            technicianName: profile?.name || 'Technician',
            productId: row.productId,
            productName: product.name,
            productPrice: product.price || 0,
            takenQuantity: qty,
            usedQuantity: 0,
            returnedQuantity: 0,
            damagedQuantity: 0,
            damageCharges: 0,
            status: 'active',
            takenAt: serverTimestamp(),
            lastTakenAt: serverTimestamp(),
          })
        }

        // Log transaction
        await addDoc(collection(db, 'stock_transactions'), {
          type: 'technician_take',
          productId: row.productId,
          productName: product.name,
          quantity: qty,
          toUser: profile?.name || 'Technician',
          technicianId: user.uid,
          timestamp: serverTimestamp(),
        })
      }

      toast.success(`✅ ${items.length} product${items.length > 1 ? 's' : ''} taken from inventory`)
      setItems([{ ...EMPTY_ITEM }])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Take Stock</h2>
        <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
          Take products from company inventory
        </p>
      </div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 shadow-sm border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
        }`}
      >
        <form onSubmit={handleTakeStock} className="space-y-4">
          {/* Product Rows */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className={`text-xs font-bold uppercase tracking-wider ${
                isDark ? 'text-white/60' : 'text-gray-500'
              }`}>
                Products
              </label>
              <button
                type="button"
                onClick={addRow}
                className={`text-xs font-bold transition ${
                  isDark ? 'text-cyan-400 hover:text-cyan-300' : 'text-aqua-600 hover:text-aqua-700'
                }`}
              >
                + Add Product
              </button>
            </div>

            <div className="space-y-3">
              {items.map((row, i) => {
                return (
                  <div key={i} className="flex gap-2 items-start">
                    {/* Product Select */}
                    <div className="flex-1">
                      <select
                        value={row.productId}
                        onChange={e => updateRow(i, 'productId', e.target.value)}
                        required
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                          isDark
                            ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
                        }`}
                      >
                        <option value="" className="text-gray-900">
                          {products.length === 0 ? 'No products available' : 'Select product'}
                        </option>
                        {products.map(prod => (
                          <option key={prod.id} value={prod.id} className="text-gray-900">
                            {prod.name}
                          </option>
                        ))}
                      </select>
                      {products.length === 0 && (
                        <p className={`text-xs mt-1 ml-1 ${
                          isDark ? 'text-amber-300' : 'text-amber-600'
                        }`}>
                          ⚠️ No products in inventory. Contact admin to add products.
                        </p>
                      )}
                    </div>

                    {/* Quantity */}
                    <div className="w-24">
                      <input
                        type="number"
                        min={1}
                        value={row.quantity}
                        onChange={e => updateRow(i, 'quantity', e.target.value)}
                        placeholder="Qty"
                        required
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 transition ${
                          isDark
                            ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                            : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
                        }`}
                      />
                    </div>

                    {/* Remove Button */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg transition flex-shrink-0 ${
                          isDark
                            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            : 'bg-red-50 text-red-400 hover:bg-red-100'
                        }`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Summary */}
          {items.some(r => r.productId && r.quantity) && (
            <div className={`rounded-xl px-4 py-3 text-xs space-y-1 ${
              isDark
                ? 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-300'
                : 'bg-aqua-50 border border-aqua-200 text-aqua-700'
            }`}>
              <p className="font-bold mb-1">📦 Taking Summary</p>
              {items.filter(r => r.productId && r.quantity).map((r, i) => {
                const name = products.find(prod => prod.id === r.productId)?.name
                return <p key={i}>• {name} × {r.quantity}</p>
              })}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-60 ${
              isDark
                ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-md'
            }`}
          >
            {saving ? '⏳ Taking Stock...' : `📤 Take ${items.length > 1 ? `${items.length} Products` : 'Stock'}`}
          </button>
        </form>
      </motion.div>

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
          ℹ️ Important Information
        </p>
        <ul className={`text-xs space-y-1 ${isDark ? 'text-blue-300/80' : 'text-blue-600'}`}>
          <li>• Maximum limit: <span className="font-bold">20 units per product</span></li>
          <li>• Take products from company inventory for your jobs</li>
          <li>• Track what you use and mark damaged items</li>
          <li>• Admin will be notified if stock is running low</li>
        </ul>
      </motion.div>
    </div>
  )
}
