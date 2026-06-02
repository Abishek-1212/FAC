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
              Choose Category
            </label>
            <select
              value={selectedCategory}
              onChange={e => {
                setSelectedCategory(e.target.value)
                setCurrentProduct('')
              }}
              style={isDark ? {
                background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                boxShadow: 'inset 3px 3px 7px #0d1420, inset -2px -2px 6px #253050',
              } : {
                background: 'linear-gradient(145deg, #e2e8f0, #f8faff)',
                boxShadow: 'inset 3px 3px 7px #c8d0de, inset -2px -2px 6px #ffffff',
              }}
              className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none border-0 transition ${
                isDark ? 'text-white' : 'text-gray-900'
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
                Select Product
              </label>
              <select
                value={currentProduct}
                onChange={e => setCurrentProduct(e.target.value)}
                style={isDark ? {
                  background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                  boxShadow: 'inset 3px 3px 7px #0d1420, inset -2px -2px 6px #253050',
                } : {
                  background: 'linear-gradient(145deg, #e2e8f0, #f8faff)',
                  boxShadow: 'inset 3px 3px 7px #c8d0de, inset -2px -2px 6px #ffffff',
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none border-0 transition ${
                  isDark ? 'text-white' : 'text-gray-900'
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
                Enter Quantity
              </label>
              <input
                type="number"
                min={1}
                value={currentQuantity}
                onChange={e => setCurrentQuantity(e.target.value)}
                placeholder="Enter quantity"
                style={isDark ? {
                  background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                  boxShadow: 'inset 3px 3px 7px #0d1420, inset -2px -2px 6px #253050',
                } : {
                  background: 'linear-gradient(145deg, #e2e8f0, #f8faff)',
                  boxShadow: 'inset 3px 3px 7px #c8d0de, inset -2px -2px 6px #ffffff',
                }}
                className={`w-full rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none border-0 transition ${
                  isDark ? 'text-white' : 'text-gray-900'
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
                      <p style={isDark ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)', boxShadow: 'inset 2px 2px 5px #1a0808, inset -1px -1px 4px #5a2020' } : { background: 'linear-gradient(145deg, #fee2e2, #fff5f5)', boxShadow: 'inset 2px 2px 5px #f0b8b8, inset -1px -1px 4px #ffffff' }} className={`text-xs mt-2 px-3 py-2 rounded-xl flex items-center gap-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                        <span>❌</span><span>Insufficient stock! Only {availableQty} units available in inventory.</span>
                      </p>
                    )
                  }
                  if (totalAfterTaking > MAX_PER_PRODUCT) {
                    return (
                      <p style={isDark ? { background: 'linear-gradient(145deg, #3b2e0d, #4a3a12)', boxShadow: 'inset 2px 2px 5px #1a1205, inset -1px -1px 4px #604518' } : { background: 'linear-gradient(145deg, #fef3c7, #fffbeb)', boxShadow: 'inset 2px 2px 5px #e8d49a, inset -1px -1px 4px #ffffff' }} className={`text-xs mt-2 px-3 py-2 rounded-xl flex items-center gap-2 ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>
                        <span>⚠️</span><span>Limit exceeded! You have {currentHolding} units. Max allowed: {MAX_PER_PRODUCT} per product.</span>
                      </p>
                    )
                  }
                  return (
                    <p style={isDark ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)', boxShadow: 'inset 2px 2px 5px #091a0d, inset -1px -1px 4px #205530' } : { background: 'linear-gradient(145deg, #dcfce7, #f0fdf4)', boxShadow: 'inset 2px 2px 5px #a7d9b8, inset -1px -1px 4px #ffffff' }} className={`text-xs mt-2 px-3 py-2 rounded-xl flex items-center gap-2 ${isDark ? 'text-green-300' : 'text-green-600'}`}>
                      <span>✅</span><span>{currentHolding > 0 ? `You'll have: ${totalAfterTaking}/${MAX_PER_PRODUCT} units` : `Available in inventory`}</span>
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
                    style={isValid
                      ? isDark
                        ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)', boxShadow: '4px 4px 10px #091a0d, -3px -3px 8px #205530' }
                        : { background: 'linear-gradient(145deg, #dcfce7, #f0fdf4)', boxShadow: '4px 4px 10px #a7d9b8, -3px -3px 8px #ffffff' }
                      : isDark
                        ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: 'inset 2px 2px 5px #0d0d0d, inset -1px -1px 4px #333333' }
                        : { background: 'linear-gradient(145deg, #e0e0e0, #f0f0f0)', boxShadow: 'inset 2px 2px 5px #c8c8c8, inset -1px -1px 4px #ffffff' }
                    }
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                      isValid
                        ? isDark ? 'text-emerald-300' : 'text-emerald-700'
                        : 'text-gray-400 cursor-not-allowed'
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
                      style={isDark
                        ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: '4px 4px 10px #0d0d0d, -3px -3px 8px #333333' }
                        : { background: 'linear-gradient(145deg, #e2e8f0, #f8faff)', boxShadow: '4px 4px 10px #c0c8d8, -3px -3px 8px #ffffff' }
                      }
                      className={`px-4 rounded-xl py-2.5 text-sm font-bold transition ${
                        isDark ? 'text-gray-300' : 'text-gray-600'
                      }`}
                    >
                      Cancel
                    </button>
                  )}
                </>
              )
            })()}

          </div>

          {/* Added Items List */}
          {addedItems.length > 0 && (
            <div
              style={isDark ? {
                background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                boxShadow: 'inset 3px 3px 8px #0d1420, inset -2px -2px 6px #253050',
              } : {
                background: 'linear-gradient(145deg, #e2e8f0, #f0f4fa)',
                boxShadow: 'inset 3px 3px 8px #c8d0de, inset -2px -2px 6px #ffffff',
              }}
              className="rounded-2xl p-4"
            >
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
                      style={isEditing
                        ? isDark
                          ? { background: 'linear-gradient(145deg, #0e3a4a, #114455)', boxShadow: '3px 3px 8px #071e25, -2px -2px 6px #1a5566' }
                          : { background: 'linear-gradient(145deg, #cffafe, #e0f9ff)', boxShadow: '3px 3px 8px #a0d8e8, -2px -2px 6px #ffffff' }
                        : isDark
                          ? { background: 'linear-gradient(145deg, #1c2333, #232d42)', boxShadow: '3px 3px 8px #0d1420, -2px -2px 6px #2a3550' }
                          : { background: 'linear-gradient(145deg, #eaf0fa, #f8fbff)', boxShadow: '3px 3px 8px #c8d4e8, -2px -2px 6px #ffffff' }
                      }
                      className="flex items-center justify-between p-3 rounded-xl cursor-pointer transition"
                    >
                      <div className="flex-1">
                        <p className={`text-sm font-bold ${
                          isDark ? 'text-white' : 'text-gray-900'
                        }`}>
                          {item.productName}
                          {isEditing && <span className={`ml-2 text-xs ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>(Editing...)</span>}
                        </p>
                        <p className={`text-xs ${
                          isDark ? 'text-white/40' : 'text-gray-500'
                        }`}>
                          {item.category} • Qty: {item.quantity}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); removeItem(item.productId) }}
                        style={isDark
                          ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)', boxShadow: '3px 3px 7px #1a0808, -2px -2px 5px #5a2020' }
                          : { background: 'linear-gradient(145deg, #fee2e2, #fff5f5)', boxShadow: '3px 3px 7px #f0b8b8, -2px -2px 5px #ffffff' }
                        }
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-lg ${
                          isDark ? 'text-red-300' : 'text-red-500'
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
            <motion.button
              type="button"
              onClick={handleTakeStock}
              disabled={saving}
              whileHover={saving ? {} : { scale: 1.02 }}
              whileTap={saving ? {} : { scale: 0.97 }}
              style={isDark ? {
                background: 'linear-gradient(145deg, #0e7490, #0891b2)',
                boxShadow: saving ? 'inset 3px 3px 8px rgba(0,0,0,0.4), inset -2px -2px 6px rgba(255,255,255,0.05)' : '5px 5px 14px rgba(0,0,0,0.5), -3px -3px 10px rgba(6,182,212,0.15)',
              } : {
                background: 'linear-gradient(145deg, #06b6d4, #0891b2)',
                boxShadow: saving ? 'inset 3px 3px 8px rgba(0,0,0,0.2), inset -2px -2px 6px rgba(255,255,255,0.3)' : '5px 5px 14px #7dd3e8, -4px -4px 12px #ffffff',
              }}
              className="w-full rounded-2xl py-3 text-sm font-bold text-white transition disabled:opacity-60"
            >
              {saving ? '⏳ Taking Stock...' : `📤 Add to My Stock (${addedItems.length} items)`}
            </motion.button>
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
            
          </div>

          {/* Filter Pills */}
          <div className="px-5 pt-4 flex gap-2 flex-wrap">
            {[['today', 'Today'], ['month', 'This Month'], ['custom', 'Custom']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => { setStockFilter(key); }}
                style={stockFilter === key
                  ? isDark
                    ? { background: 'linear-gradient(145deg, #1a3a6e, #1e4080)', boxShadow: '3px 3px 8px #0d1b35, -2px -2px 6px #2a5090' }
                    : { background: 'linear-gradient(145deg, #2563eb, #1d4ed8)', boxShadow: '3px 3px 8px #93aee8, -2px -2px 6px #ffffff' }
                  : isDark
                    ? { background: 'linear-gradient(145deg, #161e2e, #1c2640)', boxShadow: '3px 3px 7px #0d1420, -2px -2px 5px #253050' }
                    : { background: 'linear-gradient(145deg, #e2e8f0, #f8faff)', boxShadow: '3px 3px 7px #c0c8d8, -2px -2px 5px #ffffff' }
                }
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
                  stockFilter === key
                    ? 'text-white'
                    : isDark ? 'text-white/60' : 'text-gray-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Custom Date Picker */}
          {stockFilter === 'custom' && (
            <div className="mx-5 mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[['From', 'start', customRange.end], ['To', 'end', null]].map(([lbl, key, maxVal]) => (
                  <div key={key}>
                    <label className={`text-xs font-bold block mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{lbl}</label>
                    <input
                      type="date"
                      value={customRange[key]}
                      max={key === 'start' && customRange.end ? customRange.end : undefined}
                      min={key === 'end' && customRange.start ? customRange.start : undefined}
                      onChange={e => setCustomRange(p => ({ ...p, [key]: e.target.value }))}
                      style={isDark ? {
                        background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                        boxShadow: 'inset 3px 3px 7px #0d1420, inset -2px -2px 6px #253050',
                      } : {
                        background: 'linear-gradient(145deg, #e2e8f0, #f8faff)',
                        boxShadow: 'inset 3px 3px 7px #c8d0de, inset -2px -2px 6px #ffffff',
                      }}
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold border-0 focus:outline-none ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}
                    />
                  </div>
                ))}
              </div>

              {/* Active range banner — shown as soon as both dates are picked */}
              {customRange.start && customRange.end && (
                <div
                  style={isDark ? {
                    background: 'linear-gradient(145deg, #1a3a6e, #1e4080)',
                    boxShadow: '4px 4px 10px #0d1b35, -3px -3px 8px #2a5090',
                  } : {
                    background: 'linear-gradient(145deg, #dbeafe, #eff6ff)',
                    boxShadow: '4px 4px 10px #b0c8f0, -3px -3px 8px #ffffff',
                  }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                >
                  <p className={`text-xs font-bold ${isDark ? 'text-blue-200' : 'text-blue-700'}`}>
                    {(() => {
                      const ord = (n) => { const s = ['th','st','nd','rd'], v = n % 100; return n + (s[(v-20)%10] || s[v] || s[0]) }
                      const fmt = (str) => { const d = new Date(str + 'T00:00:00'); return `${ord(d.getDate())} ${d.toLocaleString('en-IN', { month: 'long' })} ${d.getFullYear()}` }
                      return `${fmt(customRange.start)} — ${fmt(customRange.end)}`
                    })()}
                  </p>
                  <button
                    onClick={() => setCustomRange({ start: '', end: '' })}
                    style={isDark ? {
                      background: 'linear-gradient(145deg, #162d4a, #1e3a5f)',
                      boxShadow: '2px 2px 5px #0a1a2e, -1px -1px 4px #2a5080',
                    } : {
                      background: 'linear-gradient(145deg, #c8daee, #ddeaf8)',
                      boxShadow: '2px 2px 5px #a0b8d0, -2px -2px 4px #ffffff',
                    }}
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ml-3 ${isDark ? 'text-blue-300' : 'text-blue-600'}`}
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
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
                      style={isDark ? {
                        background: 'linear-gradient(145deg, #1c2333, #232d42)',
                        boxShadow: '5px 5px 12px #0d1420, -3px -3px 8px #2a3550',
                      } : {
                        background: 'linear-gradient(145deg, #e8edf5, #f5f8ff)',
                        boxShadow: '5px 5px 12px #c8d0dc, -4px -4px 10px #ffffff',
                      }}
                      className="rounded-2xl p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h4 className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{productName}</h4>
                          <span className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{productCategory}</span>
                        </div>
                      </div>
                      <div style={isDark ? {
                        background: 'linear-gradient(145deg, #162d4a, #1e3a5f)',
                        boxShadow: '3px 3px 7px #0a1a2e, -2px -2px 5px #2a5080',
                      } : {
                        background: 'linear-gradient(145deg, #dbeafe, #eff6ff)',
                        boxShadow: '3px 3px 7px #b0c8f0, -3px -3px 7px #ffffff',
                      }} className="text-center p-2 rounded-xl">
                        <p className={`text-base font-black ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>{stock.takenQuantity}</p>
                        <p className={`text-[9px] font-semibold ${isDark ? 'text-blue-400/70' : 'text-blue-600/70'}`}>Taken</p>
                      </div>
                      {(stock.lastTakenAt || stock.takenAt) && (
                        <div style={isDark ? {
                          background: 'linear-gradient(145deg, #161e2e, #1c2640)',
                          boxShadow: 'inset 2px 2px 5px #0d1420, inset -1px -1px 4px #253050',
                        } : {
                          background: 'linear-gradient(145deg, #dde3ee, #eef2f8)',
                          boxShadow: 'inset 2px 2px 5px #c0c8d8, inset -1px -1px 4px #ffffff',
                        }} className={`mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {(() => { const ts = stock.lastTakenAt || stock.takenAt; const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) })()} 
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
