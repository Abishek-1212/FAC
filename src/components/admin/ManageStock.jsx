import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import PropTypes from 'prop-types'

export default function ManageStock({ searchQuery = '' }) {
  const { isDark } = useTheme()
  const [products, setProducts] = useState([])
  const [invProducts, setInvProducts] = useState([])
  const [newStockValues, setNewStockValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [editingStockId, setEditingStockId] = useState(null)
  const [editStockQty, setEditStockQty] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'inventory'), snap => {
      setInvProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    return () => unsubs.forEach(u => u())
  }, [])

  const handleNewStockChange = (productId, value) => {
    setNewStockValues(prev => ({ ...prev, [productId]: value }))
  }

  const handleUpdateStock = async (product) => {
    const newStock = Number(newStockValues[product.id] || 0)
    if (newStock <= 0) {
      toast.error('Please enter a valid quantity')
      return
    }

    setSaving(true)
    try {
      const invRef = collection(db, 'inventory')
      const q = query(invRef, where('productName', '==', product.name))
      const snapshot = await getDocs(q)

      if (!snapshot.empty) {
        const existing = snapshot.docs[0]
        const existingData = existing.data()
        await updateDoc(doc(db, 'inventory', existing.id), {
          quantity: (existingData.quantity || 0) + newStock,
          totalStock: (existingData.totalStock || 0) + newStock,
          lastUpdated: serverTimestamp(),
        })
      } else {
        await addDoc(invRef, {
          productName: product.name,
          name: product.name,
          price: product.price,
          category: product.category,
          quantity: newStock,
          totalStock: newStock,
          createdAt: serverTimestamp(),
        })
      }

      toast.success(`✅ Added ${newStock} units to ${product.name}`)
      setNewStockValues(prev => ({ ...prev, [product.id]: '' }))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startEditStock = (invItem, product) => {
    setEditingStockId(invItem.id)
    setEditStockQty((invItem.quantity || 0).toString())
    setEditingProduct(product)
    setShowEditModal(true)
  }

  const cancelEditStock = () => {
    setEditingStockId(null)
    setEditStockQty('')
    setEditingProduct(null)
    setShowEditModal(false)
  }

  const saveStockQty = async () => {
    if (editStockQty === '') return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'inventory', editingStockId), {
        quantity: Number(editStockQty),
        totalStock: Number(editStockQty),
        lastUpdated: serverTimestamp(),
      })
      toast.success('✅ Stock updated')
      cancelEditStock()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`
  const inputCls = `w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`

  // Prevent scroll on number inputs
  useEffect(() => {
    const handleWheel = (e) => {
      if (document.activeElement.type === 'number') {
        document.activeElement.blur()
      }
    }
    document.addEventListener('wheel', handleWheel, { passive: true })
    return () => document.removeEventListener('wheel', handleWheel)
  }, [])

  // Filter products based on search query (search by product name, category, and description)
  const filteredProducts = searchQuery
    ? products.filter(p => {
        const query = searchQuery.toLowerCase()
        return (
          p.name.toLowerCase().includes(query) ||
          (p.category && p.category.toLowerCase().includes(query)) ||
          (p.description && p.description.toLowerCase().includes(query))
        )
      })
    : products

  // Group by category
  const grouped = {}
  filteredProducts.forEach(p => {
    const cat = p.category || 'Uncategorized'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(p)
  })

  // Sort categories by total shortage (sum of threshold - qty for all low-stock products)
  const sortedGroupEntries = Object.entries(grouped).sort(([, prodsA], [, prodsB]) => {
    const shortage = (prods) => prods.reduce((sum, p) => {
      const inv = invProducts.find(inv => inv.productName === p.name || inv.name === p.name)
      const qty = inv?.quantity ?? 0
      const thresh = p.threshold || 0
      return thresh > 0 && qty < thresh ? sum + (thresh - qty) : sum
    }, 0)
    return shortage(prodsB) - shortage(prodsA)
  })

  // Sort products within each category: low stock first, then alphabetically
  Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a, b) => {
      const invA = invProducts.find(inv => inv.productName === a.name || inv.name === a.name)
      const invB = invProducts.find(inv => inv.productName === b.name || inv.name === b.name)
      const qtyA = invA?.quantity ?? 0
      const qtyB = invB?.quantity ?? 0
      const isLowA = (a.threshold || 0) > 0 && qtyA <= (a.threshold || 0)
      const isLowB = (b.threshold || 0) > 0 && qtyB <= (b.threshold || 0)
      if (isLowA !== isLowB) return isLowA ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  })

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {products.length === 0 ? (
        <div className={`${cardBase} p-12 text-center`}>
          <p className="text-4xl mb-3">📦</p>
          <p className={`text-sm ${s}`}>No products available</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className={`${cardBase} p-12 text-center`}>
          <p className="text-4xl mb-3">🔍</p>
          <p className={`text-sm ${s}`}>No products found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedGroupEntries.map(([category, categoryProducts]) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-1 h-5 rounded-full ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                <h4 className={`text-base font-black ${t}`}>{category}</h4>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}`}>
                  {categoryProducts.length} items
                </span>
              </div>

              <div className={`${cardBase} overflow-hidden`}>
                {/* Table Header */}
                <div className={`grid grid-cols-12 gap-3 px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${isDark ? 'border-white/10 text-white/40' : 'border-gray-100 text-gray-400'}`}>
                  <div className="col-span-4">Product</div>
                  <div className="col-span-2 text-center">Avail Stock</div>
                  <div className="col-span-3 text-center">New Stock</div>
                  <div className="col-span-3 text-right">Action</div>
                </div>

                {/* Table Rows */}
                <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-50'}`}>
                  {categoryProducts.map((product, i) => {
                    const invItem = invProducts.find(inv => inv.productName === product.name || inv.name === product.name)
                    const stockQty = invItem?.quantity || 0
                    const threshold = product.threshold || 0
                    const isLowStock = threshold > 0 && stockQty <= threshold

                    return (
                      <motion.div
                        key={product.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className={`grid grid-cols-12 gap-3 items-center px-4 py-3.5 transition ${
                          isLowStock
                            ? isDark ? 'bg-red-500/10 hover:bg-red-500/15 border-l-2 border-red-500/50' : 'bg-red-50 hover:bg-red-100 border-l-2 border-red-400'
                            : isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        {/* Product Name */}
                        <div className="col-span-4 min-w-0">
                          <p className={`font-bold text-sm truncate ${t}`}>{product.name}</p>
                          {product.description && (
                            <p className={`text-xs truncate ${s}`}>{product.description}</p>
                          )}
                        </div>

                        {/* Available Stock - Red if low, Blue if normal */}
                        <div className="col-span-2 flex justify-center">
                          <span
                            onClick={() => invItem && startEditStock(invItem, product)}
                            className={`text-sm font-black px-3 py-1.5 rounded-lg cursor-pointer transition ${
                              isLowStock
                                ? isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-700 hover:bg-red-200'
                                : isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                            }`}
                          >
                            {stockQty}
                          </span>
                        </div>

                        {/* New Stock Input */}
                        <div className="col-span-3">
                          <input
                            type="number"
                            min="0"
                            value={newStockValues[product.id] || ''}
                            onChange={(e) => handleNewStockChange(product.id, e.target.value)}
                            placeholder="0"
                            className={inputCls}
                          />
                        </div>

                        {/* Action Button */}
                        <div className="col-span-3 flex justify-end">
                          <button
                            onClick={() => handleUpdateStock(product)}
                            disabled={saving || !newStockValues[product.id] || Number(newStockValues[product.id]) <= 0}
                            className="px-4 py-2 rounded-lg bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? '...' : '+ Add'}
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Stock Modal */}
      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800 border border-white/10' : 'bg-white'}`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <h3 className={`text-lg font-black ${t}`}>Edit Stock</h3>
            </div>

            {/* Content */}
            <div className="px-6 py-5 space-y-4">
              {/* Product Info */}
              <div className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                <div className="space-y-2">
                  <div>
                    <p className={`text-xs font-semibold ${s}`}>Category</p>
                    <p className={`text-sm font-bold ${t}`}>{editingProduct.category || 'Uncategorized'}</p>
                  </div>
                  <div>
                    <p className={`text-xs font-semibold ${s}`}>Product Name</p>
                    <p className={`text-base font-black ${t}`}>{editingProduct.name}</p>
                  </div>
                </div>
              </div>

              {/* Stock Input */}
              <div>
                <label className={`text-sm font-semibold block mb-2 ${t}`}>Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={editStockQty}
                  onChange={(e) => setEditStockQty(e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl border text-base font-bold text-center focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex gap-3 ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <button
                onClick={cancelEditStock}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Cancel
              </button>
              <button
                onClick={saveStockQty}
                disabled={saving || editStockQty === ''}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-500 text-white text-sm font-bold hover:bg-green-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

ManageStock.propTypes = {
  searchQuery: PropTypes.string
}
