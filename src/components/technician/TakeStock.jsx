import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, doc, getDoc, updateDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function TakeStock() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [addedItems, setAddedItems] = useState([])
  const [currentProduct, setCurrentProduct] = useState('')
  const [currentQuantity, setCurrentQuantity] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)
  const [technicianStock, setTechnicianStock] = useState([])
  const [stockFilter, setStockFilter] = useState('today')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const MAX_PER_PRODUCT = 20

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

  useEffect(() => {
    // Load inventory
    const u1 = onSnapshot(collection(db, 'inventory'), snap => {
      const invProds = snap.docs.map(d => ({ id: d.id, name: d.data().productName || d.data().name, price: d.data().price, ...d.data() }))
      console.log('Inventory products loaded:', invProds)
      console.log('Categories in inventory:', invProds.map(p => p.category))
      setProducts(invProds)
    })
    
    // Load categories from product_categories collection
    const u2 = onSnapshot(collection(db, 'product_categories'), snap => {
      const cats = snap.docs.map(d => d.data().name).sort()
      console.log('Categories loaded:', cats)
      setCategories(cats)
    })
    
    // Get technician's current stock to check limits
    if (user) {
      const u3 = onSnapshot(
        query(collection(db, 'technician_stock'), where('technicianId', '==', user.uid), where('status', '==', 'active')),
        snap => setTechnicianStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )
      return () => { u1(); u2(); u3() }
    }
    return () => { u1(); u2() }
  }, [user])

  const getFilteredStock = () => {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    return technicianStock.filter(s => {
      const dateField = s.lastTakenAt || s.takenAt
      if (!dateField) return stockFilter === 'today' ? false : true
      const d = dateField.toDate ? dateField.toDate() : new Date(dateField.seconds * 1000)
      if (stockFilter === 'today') return d >= today
      if (stockFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (stockFilter === 'custom' && customRange.start && customRange.end) {
        const start = new Date(customRange.start + 'T00:00:00')
        const end = new Date(customRange.end + 'T23:59:59')
        return d >= start && d <= end
      }
      return true
    })
  }

  const filteredStock = getFilteredStock()

  const addProduct = () => {
    if (!currentProduct || !currentQuantity) {
      toast.error('Select a product and enter quantity')
      return
    }
    if (Number(currentQuantity) <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }

    const product = products.find(p => p.id === currentProduct)
    const existingStock = technicianStock.find(s => s.productId === currentProduct)
    const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - existingStock.damagedQuantity) : 0
    const requestedQty = Number(currentQuantity)
    
    if (currentHolding + requestedQty > MAX_PER_PRODUCT) {
      toast.error(`Limit exceeded for "${product.name}". You currently have ${currentHolding}. Max allowed: ${MAX_PER_PRODUCT} per product.`)
      return
    }

    // Check if editing existing item
    if (editingItemId) {
      // Update existing item
      setAddedItems(addedItems.map(item => 
        item.productId === editingItemId 
          ? { ...item, quantity: currentQuantity }
          : item
      ))
      toast.success(`${product.name} updated`)
      setEditingItemId(null)
    } else {
      // Check if already added
      const existing = addedItems.find(item => item.productId === currentProduct)
      if (existing) {
        toast.error('Product already added. Click on it to edit quantity.')
        return
      }

      // Add new item
      setAddedItems([...addedItems, { productId: currentProduct, productName: product.name, quantity: currentQuantity, category: product.category || 'Uncategorized' }])
      toast.success(`${product.name} added`)
    }
    
    setCurrentProduct('')
    setCurrentQuantity('')
    setSelectedCategory('')
  }

  const editItem = (item) => {
    setEditingItemId(item.productId)
    setCurrentProduct(item.productId)
    setCurrentQuantity(item.quantity)
    setSelectedCategory(item.category)
  }

  const removeItem = (productId) => {
    setAddedItems(addedItems.filter(i => i.productId !== productId))
    if (editingItemId === productId) {
      setEditingItemId(null)
      setCurrentProduct('')
      setCurrentQuantity('')
      setSelectedCategory('')
    }
    toast.success('Item removed')
  }

  const addCategory = () => {
    setSelectedCategory('')
    setCurrentProduct('')
    setCurrentQuantity('')
    setEditingItemId(null)
  }

  const handleTakeStock = async () => {
    if (addedItems.length === 0) {
      toast.error('Add at least one product')
      return
    }

    setSaving(true)
    try {
      for (const row of addedItems) {
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
            category: product.category || 'Uncategorized',
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

      // Create admin notification for stock taken
      const itemsSummary = addedItems.map(row => `${row.productName} (${row.quantity})`).join(', ')

      await addDoc(collection(db, 'notifications'), {
        type: 'stock_taken',
        technicianId: user.uid,
        technicianName: profile?.name || 'Technician',
        items: addedItems.map(row => ({
          productId: row.productId,
          productName: row.productName,
          quantity: Number(row.quantity)
        })),
        totalItems: addedItems.length,
        message: `${profile?.name || 'Technician'} took stock: ${itemsSummary}`,
        createdAt: serverTimestamp(),
        read: false,
      })

      toast.success(`✅ ${addedItems.length} product${addedItems.length > 1 ? 's' : ''} taken from inventory`)
      setAddedItems([])
      setSelectedCategory('')
      setCurrentProduct('')
      setCurrentQuantity('')
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
        <div className="space-y-4">
          {/* Step 1: Choose Category */}
          <div>
            <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
              isDark ? 'text-white/60' : 'text-gray-500'
            }`}>
              Step 1: Choose Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value)
                setCurrentProduct('')
              }}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                isDark
                  ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                  : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
              }`}
            >
              <option value="" className="text-gray-900">Select a category...</option>
              {categories.map(cat => (
                <option key={cat} value={cat} className="text-gray-900">{cat}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Product (only if category selected) */}
          {selectedCategory && (
            <div>
              <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                isDark ? 'text-white/60' : 'text-gray-500'
              }`}>
                Step 2: Select Product
              </label>
              <select
                value={currentProduct}
                onChange={e => setCurrentProduct(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
                }`}
              >
                <option value="" className="text-gray-900">Select a product...</option>
                {(() => {
                  // Filter out already added products (except the one being edited)
                  const addedProductIds = addedItems
                    .filter(item => item.productId !== editingItemId)
                    .map(item => item.productId)
                  const categoryProducts = products
                    .filter(p => (p.category || 'Uncategorized') === selectedCategory)
                    .filter(p => !addedProductIds.includes(p.id))
                  
                  if (categoryProducts.length === 0) {
                    const allCategoryProducts = products.filter(p => (p.category || 'Uncategorized') === selectedCategory)
                    if (allCategoryProducts.length === 0) {
                      return <option value="" disabled className="text-gray-900">No products available in this category</option>
                    } else {
                      return <option value="" disabled className="text-gray-900">All products from this category already added</option>
                    }
                  }
                  return categoryProducts.map(prod => (
                    <option key={prod.id} value={prod.id} className="text-gray-900">
                      {prod.name}
                    </option>
                  ))
                })()}
              </select>
            </div>
          )}

          {/* Step 3: Enter Quantity (only if product selected) */}
          {currentProduct && (
            <div>
              <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                isDark ? 'text-white/60' : 'text-gray-500'
              }`}>
                Step 3: Enter Quantity
              </label>
              <input
                type="number"
                min={1}
                value={currentQuantity}
                onChange={e => setCurrentQuantity(e.target.value)}
                placeholder="Enter quantity"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none focus:ring-2 transition ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:ring-aqua-300'
                }`}
              />
              {(() => {
                const product = products.find(p => p.id === currentProduct)
                const availableQty = product?.quantity || 0
                const requestedQty = Number(currentQuantity) || 0
                const existingStock = technicianStock.find(s => s.productId === currentProduct)
                const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - existingStock.damagedQuantity) : 0
                const totalAfterTaking = currentHolding + requestedQty
                
                if (requestedQty > 0) {
                  if (requestedQty > availableQty) {
                    return (
                      <p className={`text-xs mt-2 px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-600'
                      }`}>
                        <span>❌</span>
                        <span>Insufficient stock! Only {availableQty} units available in inventory.</span>
                      </p>
                    )
                  }
                  if (totalAfterTaking > MAX_PER_PRODUCT) {
                    return (
                      <p className={`text-xs mt-2 px-3 py-2 rounded-lg flex items-center gap-2 ${
                        isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-600'
                      }`}>
                        <span>⚠️</span>
                        <span>Limit exceeded! You have {currentHolding} units. Max allowed: {MAX_PER_PRODUCT} per product.</span>
                      </p>
                    )
                  }
                  return (
                    <p className={`text-xs mt-2 px-3 py-2 rounded-lg flex items-center gap-2 ${
                      isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600'
                    }`}>
                      <span>✅</span>
                      <span>
                        {currentHolding > 0 
                          ? `You'll have: ${totalAfterTaking}/${MAX_PER_PRODUCT} units`
                          : `Available in inventory`
                        }
                      </span>
                    </p>
                  )
                }
              })()}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {currentProduct && currentQuantity && (() => {
              const product = products.find(p => p.id === currentProduct)
              const availableQty = product?.quantity || 0
              const requestedQty = Number(currentQuantity) || 0
              const existingStock = technicianStock.find(s => s.productId === currentProduct)
              const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - existingStock.damagedQuantity) : 0
              const totalAfterTaking = currentHolding + requestedQty
              const isValid = requestedQty > 0 && requestedQty <= availableQty && totalAfterTaking <= MAX_PER_PRODUCT
              
              return (
                <>
                  <button
                    type="button"
                    onClick={addProduct}
                    disabled={!isValid}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                      isValid
                        ? isDark
                          ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-50'
                    }`}
                  >
                    {editingItemId ? '✓ Update Product' : '✓ Add Product'}
                  </button>
                  {editingItemId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemId(null)
                        setCurrentProduct('')
                        setCurrentQuantity('')
                        setSelectedCategory('')
                      }}
                      className={`px-4 rounded-xl py-2.5 text-sm font-bold transition ${
                        isDark
                          ? 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Cancel
                    </button>
                  )}
                </>
              )
            })()}
            {addedItems.length > 0 && !editingItemId && (
              <button
                type="button"
                onClick={addCategory}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                  isDark
                    ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                + Add Category
              </button>
            )}
          </div>

          {/* Added Items List */}
          {addedItems.length > 0 && (
            <div className={`rounded-xl p-4 border ${
              isDark
                ? 'bg-white/5 border-white/10'
                : 'bg-gray-50 border-gray-200'
            }`}>
              <p className={`text-xs font-bold uppercase tracking-wider mb-3 ${
                isDark ? 'text-white/60' : 'text-gray-500'
              }`}>
                Added Items ({addedItems.length})
              </p>
              <div className="space-y-2">
                {addedItems.map(item => {
                  const isEditing = editingItemId === item.productId
                  return (
                    <div
                      key={item.productId}
                      onClick={() => editItem(item)}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition ${
                        isEditing
                          ? isDark
                            ? 'bg-cyan-500/20 border-2 border-cyan-400'
                            : 'bg-cyan-50 border-2 border-cyan-400'
                          : isDark
                          ? 'bg-white/5 hover:bg-white/10 border border-white/10'
                          : 'bg-white hover:bg-gray-50 border border-gray-200'
                      }`}
                    >
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {item.productName}
                          {isEditing && <span className="ml-2 text-xs text-cyan-500">(Editing...)</span>}
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-white/40' : 'text-gray-500'
                        }`}>
                          {item.category} • Qty: {item.quantity}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          removeItem(item.productId)
                        }}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition ${
                          isDark
                            ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                            : 'bg-red-50 text-red-500 hover:bg-red-100'
                        }`}
                      >
                        ×
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Submit Button */}
          {addedItems.length > 0 && (
            <button
              type="button"
              onClick={handleTakeStock}
              disabled={saving}
              className={`w-full rounded-xl py-3 text-sm font-bold transition disabled:opacity-60 ${
                isDark
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/20'
                  : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-md'
              }`}
            >
              {saving ? '⏳ Taking Stock...' : `📤 Add to My Stock (${addedItems.length} items)`}
            </button>
          )}
        </div>
      </motion.div>

      {/* Stock Taken History */}
      {technicianStock.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={`rounded-2xl overflow-hidden shadow-sm border ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
          }`}
        >
          <div className={`px-5 py-4 border-b ${
            isDark ? 'border-white/10' : 'border-gray-100'
          }`}>
            <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-400'}`}>History</p>
            <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>Stock You've Taken</h3>
          </div>

          {/* Filter Pills */}
          <div className="px-5 pt-4 flex gap-2 flex-wrap">
            {[['today', 'Today'], ['month', 'This Month'], ['custom', 'Custom']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setStockFilter(key); if (key === 'custom') setShowCustomPicker(true) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  stockFilter === key
                    ? isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                    : isDark ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom Date Picker */}
          {stockFilter === 'custom' && showCustomPicker && (
            <div className={`mx-5 mt-3 p-3 rounded-xl border ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>From</label>
                  <input type="date" value={customRange.start} max={customRange.end || undefined}
                    onChange={e => setCustomRange(p => ({ ...p, start: e.target.value }))}
                    className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-none ${
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
                <div>
                  <label className={`text-xs font-bold block mb-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>To</label>
                  <input type="date" value={customRange.end} min={customRange.start || undefined}
                    onChange={e => setCustomRange(p => ({ ...p, end: e.target.value }))}
                    className={`w-full px-2 py-1.5 rounded-lg text-xs border focus:outline-none ${
                      isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                    }`}
                  />
                </div>
              </div>
              <button
                onClick={() => { if (customRange.start && customRange.end) setShowCustomPicker(false) }}
                disabled={!customRange.start || !customRange.end}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50 ${
                  isDark ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                }`}
              >
                Apply
              </button>
            </div>
          )}

          {/* Applied custom range banner */}
          {stockFilter === 'custom' && !showCustomPicker && customRange.start && customRange.end && (
            <div className={`mx-5 mt-3 flex items-center justify-between px-3 py-2 rounded-xl border ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-blue-50 border-blue-200'
            }`}>
              <p className={`text-xs font-bold ${isDark ? 'text-white/70' : 'text-blue-700'}`}>
                {(() => {
                  const fmt = (str) => {
                    const d = new Date(str + 'T00:00:00')
                    const ord = (n) => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]) }
                    return `${ord(d.getDate())} ${d.toLocaleString('en-IN', { month: 'long' })} ${d.getFullYear()}`
                  }
                  return `${fmt(customRange.start)} — ${fmt(customRange.end)}`
                })()}
              </p>
              <button
                onClick={() => { setCustomRange({ start: '', end: '' }); setShowCustomPicker(true) }}
                className={`text-xs font-bold px-2 py-1 rounded-lg ml-3 ${
                  isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                }`}
              >
                ✕ Clear
              </button>
            </div>
          )}

          <div className="p-5">
            {filteredStock.length === 0 ? (
              <p className={`text-center text-sm py-6 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>No stock taken in this period</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {filteredStock.map((stock, idx) => {
                  const product = products.find(p => p.id === stock.productId)
                  const productName = product?.name || stock.productName
                  const productCategory = product?.category || 'Uncategorized'
                  return (
                    <motion.div
                      key={stock.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      className={`rounded-xl p-4 border ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{productName}</h4>
                          <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{productCategory}</span>
                        </div>
                      </div>
                      <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                        <p className="text-base font-black">{stock.takenQuantity}</p>
                        <p className="text-[9px] font-semibold opacity-70">Taken</p>
                      </div>
                      {(stock.lastTakenAt || stock.takenAt) && (
                        <div className={`mt-3 pt-3 border-t text-xs ${isDark ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-500'}`}>
                          <p className="font-semibold">📅 {(() => { const ts = stock.lastTakenAt || stock.takenAt; const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })()}</p>
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  )
}
