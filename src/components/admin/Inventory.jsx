import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, addDoc, deleteDoc, query, where, serverTimestamp, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import ManageStock from './ManageStock'
import { syncInventoryWithProducts } from '../../utils/syncInventory'

export default function Inventory() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [invProducts, setInvProducts] = useState([])
  const [products, setProducts] = useState([])
  const [techStock, setTechStock] = useState([])
  const [personalStock, setPersonalStock] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [editingId, setEditingId] = useState(null)
  const [editQty, setEditQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('manage')
  const [editingProduct, setEditingProduct] = useState(null)
  const [editPrice, setEditPrice] = useState('')
  const [showProductModal, setShowProductModal] = useState(false)
  const [productForm, setProductForm] = useState({ name: '', sku: '', category: '', price: '', description: '', threshold: '' })
  const [editingProductFull, setEditingProductFull] = useState(null)
  const [categories, setCategories] = useState([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [showStockModal, setShowStockModal] = useState(false)
  const [stockForm, setStockForm] = useState({ category: '', productId: '', quantity: '' })
  const [producerName, setProducerName] = useState('')
  const [addingStock, setAddingStock] = useState(false)
  const [stockItems, setStockItems] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const unsubs = []
    unsubs.push(onSnapshot(collection(db, 'inventory'), snap => {
      setInvProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'products'), snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'product_categories'), snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    }))
    unsubs.push(onSnapshot(collection(db, 'technician_personal_stock'), snap => {
      setPersonalStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    }))
    unsubs.push(onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      snap => setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    ))
    return () => unsubs.forEach(u => u())
  }, [])



  const startEditProduct = (product) => {
    setEditingProduct(product.id)
    setEditPrice((product.price || 0).toString())
  }

  const cancelEditProduct = () => {
    setEditingProduct(null)
    setEditPrice('')
  }

  const savePrice = async (productId) => {
    if (editPrice === '') return
    setSaving(true)
    try {
      await updateDoc(doc(db, 'products', productId), {
        price: Number(editPrice),
        lastUpdated: serverTimestamp(),
      })
      toast.success('✅ Price updated')
      setEditingProduct(null)
      setEditPrice('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const openAddProduct = () => {
    setProductForm({ name: '', sku: '', category: '', price: '', description: '', threshold: '' })
    setEditingProductFull(null)
    setShowProductModal(true)
  }

  const openEditProduct = (product) => {
    setProductForm({
      name: product.name,
      sku: product.sku || '',
      category: product.category || '',
      price: String(product.price || ''),
      description: product.description || '',
      threshold: String(product.threshold || '')
    })
    setEditingProductFull(product.id)
    setShowProductModal(true)
  }

  const handleSaveProduct = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...productForm, price: Number(productForm.price), threshold: productForm.threshold ? Number(productForm.threshold) : 0 }
      if (editingProductFull) {
        const oldProduct = products.find(p => p.id === editingProductFull)
        await updateDoc(doc(db, 'products', editingProductFull), data)
        
        // Update inventory collection if product name or price changed
        const invRef = collection(db, 'inventory')
        const q = query(invRef, where('productName', '==', oldProduct.name))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const invDoc = snapshot.docs[0]
          await updateDoc(doc(db, 'inventory', invDoc.id), {
            productName: data.name,
            name: data.name,
            price: data.price,
            category: data.category,
            lastUpdated: serverTimestamp(),
          })
        }
        
        toast.success('✅ Product updated')
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() })
        toast.success('✅ Product added')
      }
      setShowProductModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProduct = async (id) => {
    if (!confirm('Delete this product?')) return
    try {
      await deleteDoc(doc(db, 'products', id))
      toast.success('✅ Product deleted')
      setShowProductModal(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleAddCategory = async (e) => {
    e.preventDefault()
    const name = newCategory.trim()
    if (!name) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    setAddingCategory(true)
    try {
      await addDoc(collection(db, 'product_categories'), { name, createdAt: serverTimestamp() })
      toast.success(`✅ "${name}" added`)
      setNewCategory('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddingCategory(false)
    }
  }

  const handleDeleteCategory = async (cat) => {
    const inUse = products.some(p => p.category === cat.name)
    if (inUse) {
      toast.error(`"${cat.name}" is used by products. Reassign them first.`)
      return
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return
    try {
      await deleteDoc(doc(db, 'product_categories', cat.id))
      toast.success('✅ Category deleted')
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleSyncInventory = async () => {
    if (!confirm('Sync all inventory items with latest product data? This will update prices and names.')) return
    setSyncing(true)
    try {
      const result = await syncInventoryWithProducts()
      if (result.success) {
        toast.success(`✅ Synced ${result.updatedCount} items successfully!`)
      } else {
        toast.error(`Failed: ${result.error}`)
      }
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSyncing(false)
    }
  }

  const openManageStock = () => {
    setStockForm({ category: '', productId: '', quantity: '' })
    setProducerName('')
    setStockItems([])
    setShowStockModal(true)
  }

  const addStockItem = () => {
    if (!producerName.trim()) {
      toast.error('Please enter producer name first')
      return
    }
    if (!stockForm.productId || !stockForm.quantity) {
      toast.error('Please select product and enter quantity')
      return
    }
    const product = products.find(p => p.id === stockForm.productId)
    const newItem = {
      id: Date.now(),
      productId: stockForm.productId,
      productName: product.name,
      category: stockForm.category,
      quantity: Number(stockForm.quantity),
      producerName: producerName.trim(),
      price: product.price
    }
    setStockItems([...stockItems, newItem])
    setStockForm({ category: stockForm.category, productId: '', quantity: '' })
  }

  const removeStockItem = (id) => {
    setStockItems(stockItems.filter(item => item.id !== id))
  }

  const handleAddStock = async (e) => {
    e.preventDefault()
    if (stockItems.length === 0) {
      toast.error('Please add at least one product')
      return
    }
    setAddingStock(true)
    try {
      for (const item of stockItems) {
        const product = products.find(p => p.id === item.productId)
        const invRef = collection(db, 'inventory')
        const q = query(invRef, where('productName', '==', product.name))
        const snapshot = await getDocs(q)
        
        if (!snapshot.empty) {
          // Update existing
          const existing = snapshot.docs[0]
          const existingData = existing.data()
          await updateDoc(doc(db, 'inventory', existing.id), {
            quantity: (existingData.quantity || 0) + item.quantity,
            totalStock: (existingData.totalStock || 0) + item.quantity,
            producerName: item.producerName || existingData.producerName,
            lastUpdated: serverTimestamp(),
          })
        } else {
          // Add new
          await addDoc(invRef, {
            productName: product.name,
            name: product.name,
            price: product.price,
            category: product.category,
            producerName: item.producerName,
            quantity: item.quantity,
            totalStock: item.quantity,
            createdAt: serverTimestamp(),
          })
        }
      }
      toast.success(`✅ Stock updated for ${stockItems.length} product(s)`)
      setShowStockModal(false)
      setStockItems([])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddingStock(false)
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

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col items-center gap-4">
        <div className="text-center">
          <h2 className={`text-2xl font-black ${t}`}>Inventory Management</h2>
        </div>
        <div className={`flex items-center gap-3 border rounded-full p-1 ${isDark ? 'border-white/20' : 'border-gray-300'}`}>
          <button
            onClick={() => setShowCategoryModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500 border border-cyan-500 text-white text-xs font-bold hover:bg-cyan-600 transition"
          >
            Manage Categories
          </button>
          <button
            onClick={openAddProduct}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500 border border-cyan-500 text-white text-xs font-bold hover:bg-cyan-600 transition"
          >
            <span className="text-xs">+</span> Add Product
          </button>
          <button
            onClick={handleSyncInventory}
            disabled={syncing}
            className="flex items-center justify-center px-4 py-2 rounded-full bg-purple-500 border border-purple-500 text-white text-xs font-bold hover:bg-purple-600 transition disabled:opacity-60"
          >
            {syncing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by product name..."
          className={`w-full px-4 py-3 pl-12 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
        />
        <svg className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-white/30' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
        </svg>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className={`absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs transition ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
          >
            ✕
          </button>
        )}
      </div>

      {/* Tab Pills */}
      <div className="flex justify-center">
        <div className={`flex gap-3 border rounded-full p-1 ${isDark ? 'border-white/20' : 'border-gray-300'}`}>
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition border ${
              activeTab === 'manage'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 border-cyan-500'
                : isDark ? 'bg-transparent text-white/60 hover:bg-white/10 border-white/10' : 'bg-transparent text-gray-600 hover:bg-gray-200 border-black/20'
            }`}
          >
            MANAGE STOCK
          </button>
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-4 py-2 rounded-full text-xs font-bold transition border ${
              activeTab === 'inventory'
                ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 border-cyan-500'
                : isDark ? 'bg-transparent text-white/60 hover:bg-white/10 border-white/10' : 'bg-transparent text-gray-600 hover:bg-gray-200 border-black/20'
            }`}
          >
           INVENTORY STOCK
          </button>
        </div>
      </div>



      {/* SECTION 1: PRODUCT INVENTORY — Table Layout */}
      {activeTab === 'inventory' && (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className={`w-1 h-6 rounded-full ${isDark ? 'bg-cyan-400' : 'bg-cyan-500'}`} />
          <h3 className={`text-lg font-black ${t}`}>Product Inventory</h3>
        </div>

        {products.length === 0 ? (
          <div className={`${cardBase} p-12 text-center`}>
            <p className="text-4xl mb-3">📦</p>
            <p className={`text-sm ${s}`}>No products yet. Click "Add Product" to get started.</p>
          </div>
        ) : (() => {
          const grouped = {}
          // Filter products based on search query
          const filteredProducts = products.filter(p => 
            p.name.toLowerCase().includes(searchQuery.toLowerCase())
          )
          
          filteredProducts.forEach(p => {
            const cat = p.category || 'Uncategorized'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(p)
          })

          // Sort each category: low stock first, then alphabetically
          Object.keys(grouped).forEach(cat => {
            grouped[cat].sort((a, b) => {
              const invA = invProducts.find(inv => inv.productName === a.name || inv.name === a.name)
              const invB = invProducts.find(inv => inv.productName === b.name || inv.name === b.name)
              const qtyA = invA?.quantity || 0
              const qtyB = invB?.quantity || 0
              const isLowA = (a.threshold || 0) > 0 && qtyA <= (a.threshold || 0)
              const isLowB = (b.threshold || 0) > 0 && qtyB <= (b.threshold || 0)
              if (isLowA !== isLowB) return isLowA ? -1 : 1
              return a.name.localeCompare(b.name)
            })
          })
          
          if (filteredProducts.length === 0) {
            return (
              <div className={`${cardBase} p-12 text-center`}>
                <p className="text-4xl mb-3">🔍</p>
                <p className={`text-sm ${s}`}>No products found matching "{searchQuery}"</p>
              </div>
            )
          }
          
          return (
            <div className="space-y-6">
              {Object.entries(grouped).map(([category, categoryProducts]) => (
                <div key={category}>
                  {/* Category Header */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-1 h-5 rounded-full ${isDark ? 'bg-purple-400' : 'bg-purple-500'}`} />
                    <h4 className={`text-base font-black ${t}`}>{category}</h4>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isDark ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'}`}>
                      {categoryProducts.length} items
                    </span>
                  </div>

                  {/* Products Table */}
                  <div className={`${cardBase} overflow-hidden`}>
                    {/* Table Header */}
                    <div className={`grid grid-cols-12 px-4 py-3 border-b text-xs font-bold uppercase tracking-wider ${isDark ? 'border-white/10 text-white/40' : 'border-gray-100 text-gray-400'}`}>
                      <div className="col-span-10">Product</div>
                      <div className="col-span-2 text-right">Price</div>
                    </div>

                    {/* Table Rows */}
                    <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-50'}`}>
                      {categoryProducts.map((product, i) => {
                        const invItem = invProducts.find(inv => inv.productName === product.name || inv.name === product.name)
                        const stockQty = invItem?.quantity || 0

                        return (
                          <motion.div
                            key={product.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className={`grid grid-cols-12 items-center px-4 py-3.5 transition ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
                          >
                            {/* Product Name + Description */}
                            <div className="col-span-10 min-w-0 cursor-pointer" onClick={() => openEditProduct(product)}>
                              <p className={`font-bold text-sm truncate ${t}`}>{product.name}</p>
                              {product.description && (
                                <p className={`text-xs truncate ${s}`}>{product.description}</p>
                              )}
                            </div>

                            {/* Price */}
                            <div className="col-span-2 flex items-center justify-end gap-2">
                              <span className={`text-sm font-black ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                                ₹{(product.price || 0).toLocaleString('en-IN')}
                              </span>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Hint */}
        {products.length > 0 && (
          <p className={`text-xs mt-2 ml-1 ${s}`}>💡 Click on the product name to edit details</p>
        )}
      </div>
      )}

      {/* SECTION 0: MANAGE STOCK */}
      {activeTab === 'manage' && <ManageStock searchQuery={searchQuery} />}

      {/* Add/Edit Product Modal */}
      <Modal open={showProductModal} onClose={() => setShowProductModal(false)} title={editingProductFull ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSaveProduct} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Product Name *</label>
              <input type="text" value={productForm.name} onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))} required className={inputCls} />
            </div>
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>SKU (optional)</label>
              <input type="text" value={productForm.sku} onChange={e => setProductForm(f => ({ ...f, sku: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Price (₹) *</label>
            <input type="number" value={productForm.price} onChange={e => setProductForm(f => ({ ...f, price: e.target.value }))} required className={inputCls} />
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Category *</label>
            <select value={productForm.category} onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))} required className={inputCls}>
              <option value="">Select category</option>
              {categories.map(c => (<option key={c.id} value={c.name}>{c.name}</option>))}
            </select>
            {categories.length === 0 && (<p className="text-xs text-amber-600 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">⚠️ No categories yet. Add one first.</p>)}
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Description</label>
            <textarea value={productForm.description} onChange={e => setProductForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Enter product description..." className={inputCls} />
          </div>
          <div>
            <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Low Stock Threshold *</label>
            <input type="number" min="0" value={productForm.threshold} onChange={e => setProductForm(f => ({ ...f, threshold: e.target.value }))} placeholder="Alert when stock falls below this" required className={inputCls} />
            <p className={`text-xs mt-1 ${s}`}>When stock ≤ threshold, item shows in red</p>
          </div>
          <div className="flex gap-2 pt-3 border-t border-gray-100">
            {editingProductFull && (<button type="button" onClick={() => handleDeleteProduct(editingProductFull)} className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition ${isDark ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-700'}`}>🗑️ Delete</button>)}
            <button type="submit" disabled={saving} className="flex-1 bg-cyan-500 text-white rounded-lg py-2.5 text-sm font-semibold hover:bg-cyan-600 transition disabled:opacity-60">{saving ? 'Saving...' : editingProductFull ? 'Update' : 'Add Product'}</button>
          </div>
        </form>
      </Modal>

      {/* Manage Categories Modal */}
      <Modal open={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Manage Categories">
        <div className="space-y-4">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="New category name..." className={inputCls} />
            <button type="submit" disabled={addingCategory || !newCategory.trim()} className="bg-cyan-500 text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-cyan-600 transition disabled:opacity-50">{addingCategory ? '...' : 'Add'}</button>
          </form>
          {categories.length === 0 ? (
            <div className={`text-center py-8 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}><p className={`text-sm ${s}`}>No categories yet. Add one above.</p></div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className={`flex items-center justify-between rounded-xl px-4 py-3 transition group ${isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-50 hover:bg-gray-100'}`}>
                  <span className={`text-sm font-semibold ${t}`}>{cat.name}</span>
                  <button onClick={() => handleDeleteCategory(cat)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition opacity-0 group-hover:opacity-100 ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-400 hover:bg-red-100'}`}>🗑️</button>
                </div>
              ))}
            </div>
          )}
          <p className={`text-xs bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 ${isDark ? 'bg-blue-500/10 border-blue-500/30 text-blue-300' : 'text-blue-600'}`}>ℹ️ Categories in use by products cannot be deleted.</p>
        </div>
      </Modal>

      {/* Manage Stock Modal */}
      <Modal open={showStockModal} onClose={() => setShowStockModal(false)} title="Manage Stock">
        <div className="space-y-4">
          {/* Add Stock Form */}
          <div className="space-y-3">
            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Producer Name *</label>
              <input
                type="text"
                value={producerName}
                onChange={e => setProducerName(e.target.value)}
                placeholder="Enter producer name"
                className={inputCls}
              />
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Category *</label>
              <select
                value={stockForm.category}
                onChange={e => setStockForm(f => ({ ...f, category: e.target.value, productId: '' }))}
                className={inputCls}
              >
                <option value="">Select category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Product *</label>
              <select
                value={stockForm.productId}
                onChange={e => setStockForm(f => ({ ...f, productId: e.target.value }))}
                disabled={!stockForm.category}
                className={inputCls}
              >
                <option value="">Select product</option>
                {products.filter(p => p.category === stockForm.category).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={`text-xs font-semibold block mb-1.5 ${s}`}>Quantity *</label>
              <input
                type="number"
                min="1"
                value={stockForm.quantity}
                onChange={e => setStockForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="Enter quantity"
                className={inputCls}
              />
            </div>

            <button
              type="button"
              onClick={addStockItem}
              className="w-full bg-blue-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-blue-600 transition"
            >
              + Add to List
            </button>
          </div>

          {/* Stock Items List */}
          {stockItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className={`text-xs font-semibold ${s}`}>Added Items ({stockItems.length})</label>
              </div>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {stockItems.map(item => (
                  <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold truncate ${t}`}>{item.productName}</p>
                      <p className={`text-xs ${s}`}>
                        {item.quantity} units
                        {item.producerName && ` • ${item.producerName}`}
                      </p>
                    </div>
                    <button
                      onClick={() => removeStockItem(item.id)}
                      className={`ml-3 w-8 h-8 rounded-lg flex items-center justify-center transition ${isDark ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-50 text-red-500 hover:bg-red-100'}`}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}">
            <button
              type="button"
              onClick={() => setShowStockModal(false)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddStock}
              disabled={addingStock || stockItems.length === 0}
              className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-green-600 transition disabled:opacity-60"
            >
              {addingStock ? 'Updating...' : `✅ Update Stock (${stockItems.length})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
