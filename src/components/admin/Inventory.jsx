import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, addDoc, query, where, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'

export default function Inventory() {
  const { isDark } = useTheme()
  const [invProducts, setInvProducts] = useState([])
  const [techStock, setTechStock] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAddProduct, setShowAddProduct] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', price: '', dealerName: '' })
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'inventory'), snap => {
      setInvProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'technician_stock'), snap => {
      setTechStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))
    return () => unsubs.forEach(u => u())
  }, [])

  const handleAddProduct = async (e) => {
    e.preventDefault()
    if (!addForm.name.trim() || !addForm.price) return
    setAdding(true)
    try {
      await addDoc(collection(db, 'inventory'), {
        productName: addForm.name.trim(),
        name: addForm.name.trim(),
        price: Number(addForm.price),
        dealerName: addForm.dealerName.trim(),
        quantity: 0,
        totalStock: 0,
        createdAt: serverTimestamp(),
      })
      toast.success('✅ Product added')
      setAddForm({ name: '', price: '', dealerName: '' })
      setShowAddProduct(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAdding(false)
    }
  }

  const startEdit = (product) => {
    setEditingId(product.id)
    setEditQty((product.quantity || 0).toString())
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditQty('')
  }

  const saveQty = async (productId) => {
    if (editQty === '') return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'inventory', productId), {
        quantity: Number(editQty),
        totalStock: Number(editQty),
        lastUpdated: serverTimestamp(),
      })
      toast.success('✅ Stock updated')
      setEditingId(null)
      setEditQty('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`
  const inputCls = `w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className={`text-2xl font-black ${t}`}>Inventory Management</h2>
          <p className={`text-sm mt-0.5 ${s}`}>Manage stock levels and technician assignments</p>
        </div>
        <button
          onClick={() => setShowAddProduct(v => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-500 text-white text-sm font-bold hover:bg-cyan-600 transition"
        >
          <span className="text-lg">+</span> Add Product
        </button>
      </div>

      {/* Add Product Form */}
      <AnimatePresence>
        {showAddProduct && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`rounded-2xl border p-5 ${isDark ? 'bg-white/5 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'}`}
          >
            <h3 className={`font-black text-base mb-4 ${t}`}>➕ Add New Product</h3>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Product Name *</label>
                <input type="text" placeholder="e.g. Spun Filter" value={addForm.name}
                  onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Price (₹) *</label>
                <input type="number" placeholder="e.g. 150" min="0" value={addForm.price}
                  onChange={e => setAddForm(f => ({ ...f, price: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Dealer Name</label>
                <input type="text" placeholder="e.g. Ravi Traders" value={addForm.dealerName}
                  onChange={e => setAddForm(f => ({ ...f, dealerName: e.target.value }))} className={inputCls} />
              </div>
              <div className="sm:col-span-3 flex gap-3 pt-1">
                <button type="button" onClick={() => { setShowAddProduct(false); setAddForm({ name: '', price: '', dealerName: '' }) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}>
                  Cancel
                </button>
                <button type="submit" disabled={adding}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-600 transition disabled:opacity-60">
                  {adding ? 'Adding...' : '✅ Add Product'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SECTION 1: PRODUCT INVENTORY — Table Layout */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-1 h-6 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
          <h3 className={`text-lg font-black ${t}`}>Product Inventory</h3>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}`}>
            {invProducts.length} products
          </span>
        </div>

        {invProducts.length === 0 ? (
          <div className={`${cardBase} p-12 text-center`}>
            <p className="text-4xl mb-3">📦</p>
            <p className={`text-sm ${s}`}>No products yet. Click "Add Product" to get started.</p>
          </div>
        ) : (
          <div className={`${cardBase} overflow-hidden`}>
            {/* Table Header */}
            <div className={`grid grid-cols-12 px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${isDark ? 'border-white/10 text-white/40' : 'border-gray-100 text-gray-400'}`}>
              <div className="col-span-5">Product</div>
              <div className="col-span-3 text-right">Price</div>
              <div className="col-span-4 text-right">Quantity</div>
            </div>

            {/* Table Rows */}
            <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-50'}`}>
              {invProducts.map((product, i) => {
                const isEditing = editingId === product.id
                const qty = product.quantity || 0
                const isOut = qty === 0

                return (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className={`grid grid-cols-12 items-center px-4 py-3.5 transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                  >
                    {/* Product Name + Dealer */}
                    <div className="col-span-5 min-w-0">
                      <p className={`font-bold text-sm truncate ${t}`}>{product.productName || product.name}</p>
                      {product.dealerName && (
                        <p className={`text-xs truncate ${s}`}>{product.dealerName}</p>
                      )}
                    </div>

                    {/* Price */}
                    <div className="col-span-3 text-right">
                      <p className={`text-sm font-bold ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                        ₹{(product.price || 0).toLocaleString('en-IN')}
                      </p>
                    </div>

                    {/* Quantity — inline edit on click */}
                    <div className="col-span-4 flex items-center justify-end gap-2">
                      {isEditing ? (
                        <>
                          <input
                            type="number"
                            min="0"
                            value={editQty}
                            onChange={e => setEditQty(e.target.value)}
                            autoFocus
                            onKeyDown={e => {
                              if (e.key === 'Enter') saveQty(product.id)
                              if (e.key === 'Escape') cancelEdit()
                            }}
                            className={`w-20 px-2 py-1.5 rounded-lg border text-sm font-black text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                          <button
                            onClick={() => saveQty(product.id)}
                            disabled={saving}
                            className="px-2.5 py-1.5 rounded-lg bg-cyan-500 text-white text-xs font-bold hover:bg-cyan-600 transition disabled:opacity-60"
                          >
                            ✓
                          </button>
                          <button
                            onClick={cancelEdit}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(product)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition group ${
                            isOut
                              ? isDark ? 'bg-red-500/15 hover:bg-red-500/25' : 'bg-red-50 hover:bg-red-100'
                              : isDark ? 'bg-blue-500/15 hover:bg-blue-500/25' : 'bg-blue-50 hover:bg-blue-100'
                          }`}
                        >
                          <span className={`text-sm font-black ${isOut ? isDark ? 'text-red-300' : 'text-red-600' : isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                            {qty}
                          </span>
                          <svg className={`w-3 h-3 opacity-0 group-hover:opacity-100 transition ${isOut ? isDark ? 'text-red-300' : 'text-red-500' : isDark ? 'text-blue-300' : 'text-blue-500'}`}
                            fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}

        {/* Hint */}
        {invProducts.length > 0 && (
          <p className={`text-xs mt-2 ml-1 ${s}`}>💡 Click on the quantity number to edit it inline</p>
        )}
      </div>

      {/* SECTION 2: TECHNICIAN STOCK DETAILS */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className={`w-1 h-6 rounded-full ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
          <h3 className={`text-lg font-black ${t}`}>Technician Stock Details</h3>
        </div>

        {technicians.length === 0 ? (
          <div className={`${cardBase} p-12 text-center`}>
            <p className="text-4xl mb-3">👷</p>
            <p className={`text-sm ${s}`}>No technicians found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {technicians.map((tech, i) => {
              const items = techStock.filter(s => s.technicianId === tech.id && s.status === 'active')
              const totalTaken = items.reduce((sum, s) => sum + (s.takenQuantity || 0), 0)
              const totalUsed = items.reduce((sum, s) => sum + (s.usedQuantity || 0), 0)
              const totalReturned = items.reduce((sum, s) => sum + (s.returnedQuantity || 0), 0)
              const totalDamaged = items.reduce((sum, s) => sum + (s.damagedQuantity || 0), 0)
              const totalRemaining = items.reduce((sum, s) => sum + Math.max(
                (s.takenQuantity || 0) - (s.usedQuantity || 0) - (s.returnedQuantity || 0) - (s.damagedQuantity || 0), 0
              ), 0)

              return (
                <motion.div key={tech.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}
                >
                  <div className={`px-5 py-4 border-b ${isDark ? 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border-white/10' : 'bg-gradient-to-r from-purple-50 to-pink-50 border-gray-100'}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black flex-shrink-0 ${isDark ? 'bg-purple-500/30 text-purple-300' : 'bg-purple-500 text-white'}`}>
                        {(tech.name || 'T').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-black text-base ${t}`}>{tech.name || 'Unknown'}</p>
                        <p className={`text-xs ${s}`}>📞 {tech.phone || tech.phoneNumber || '—'}</p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { label: 'Taken', value: totalTaken, color: isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700' },
                          { label: 'Used', value: totalUsed, color: isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' },
                          { label: 'Returned', value: totalReturned, color: isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700' },
                          { label: 'Damaged', value: totalDamaged, color: isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700' },
                          { label: 'Remaining', value: totalRemaining, color: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' },
                        ].map(stat => (
                          <div key={stat.label} className={`text-center px-2.5 py-1.5 rounded-lg ${stat.color}`}>
                            <p className="text-base font-black leading-none">{stat.value}</p>
                            <p className="text-[10px] font-semibold opacity-70 mt-0.5">{stat.label}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {items.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className={`text-sm ${s}`}>No stock assigned yet</p>
                    </div>
                  ) : (
                    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {items.map((item) => {
                        const remaining = Math.max(
                          (item.takenQuantity || 0) - (item.usedQuantity || 0) - (item.returnedQuantity || 0) - (item.damagedQuantity || 0), 0
                        )
                        return (
                          <div key={item.id} className={`rounded-xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <p className={`font-black text-sm ${t}`}>{item.productName}</p>
                                {item.productPrice > 0 && (
                                  <p className={`text-xs mt-0.5 ${isDark ? 'text-purple-400' : 'text-purple-600'}`}>
                                    ₹{item.productPrice.toLocaleString('en-IN')}/unit
                                  </p>
                                )}
                              </div>
                              <span className={`text-xs font-bold px-2 py-1 rounded-lg ${remaining > 0 ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                                {remaining > 0 ? `${remaining} left` : 'All used'}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { label: 'Took', value: item.takenQuantity || 0, color: isDark ? 'bg-blue-500/15 text-blue-300' : 'bg-blue-50 text-blue-700' },
                                { label: 'Used', value: item.usedQuantity || 0, color: isDark ? 'bg-green-500/15 text-green-300' : 'bg-green-50 text-green-700' },
                                { label: 'Ret', value: item.returnedQuantity || 0, color: isDark ? 'bg-purple-500/15 text-purple-300' : 'bg-purple-50 text-purple-700' },
                                { label: 'Dmg', value: item.damagedQuantity || 0, color: isDark ? 'bg-red-500/15 text-red-300' : 'bg-red-50 text-red-700' },
                              ].map(stat => (
                                <div key={stat.label} className={`text-center p-1.5 rounded-lg ${stat.color}`}>
                                  <p className="text-sm font-black">{stat.value}</p>
                                  <p className="text-[9px] font-semibold opacity-70">{stat.label}</p>
                                </div>
                              ))}
                            </div>
                            {item.takenAt && (
                              <p className={`text-[10px] mt-2 ${s}`}>
                                📅 {item.takenAt.toDate ? new Date(item.takenAt.toDate()).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
