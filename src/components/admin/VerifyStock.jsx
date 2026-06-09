import { useEffect, useState } from 'react'
import { collection, onSnapshot, query, where, updateDoc, doc, serverTimestamp, addDoc, deleteDoc, getDocs, getDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
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
  const [drillModal, setDrillModal] = useState(null)
  const [drillData, setDrillData] = useState([])
  const [drillLoading, setDrillLoading] = useState(false)

  // Assign Stock Modal state
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignProducts, setAssignProducts] = useState([])
  const [assignCategories, setAssignCategories] = useState([])
  const [assignSelectedCategory, setAssignSelectedCategory] = useState('')
  const [assignCurrentProduct, setAssignCurrentProduct] = useState('')
  const [assignCurrentQuantity, setAssignCurrentQuantity] = useState('')
  const [assignAddedItems, setAssignAddedItems] = useState([])
  const [assignEditingId, setAssignEditingId] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const MAX_PER_PRODUCT = 20

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

    // Load inventory products and categories for assign modal
    unsubs.push(onSnapshot(collection(db, 'inventory'), snap => {
      setAssignProducts(snap.docs.map(d => ({ id: d.id, name: d.data().productName || d.data().name, ...d.data() })))
    }))
    unsubs.push(onSnapshot(collection(db, 'product_categories'), snap => {
      setAssignCategories(snap.docs.map(d => d.data().name).sort())
    }))
    
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
      
      // Add returned quantity back to admin inventory
      const invQuery = query(collection(db, 'inventory'), where('productName', '==', selectedStock.productName))
      const invSnap = await getDocs(invQuery)
      
      if (!invSnap.empty) {
        const invDoc = invSnap.docs[0]
        const currentQty = invDoc.data().quantity || 0
        await updateDoc(doc(db, 'inventory', invDoc.id), {
          quantity: currentQty + qty,
          totalStock: (invDoc.data().totalStock || 0) + qty,
          lastUpdated: serverTimestamp(),
        })
      }
      
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

  const fmtDate = (ts) => {
    if (!ts) return '—'
    const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const openDrill = async (type, stock) => {
    setDrillModal({ type, productName: stock.productName, productId: stock.productId, technicianId: stock.technicianId })
    setDrillData([])
    setDrillLoading(true)
    try {
      if (type === 'Taken') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'technician_take'), where('technicianId', '==', stock.technicianId), where('productId', '==', stock.productId)))
        const rows = snap.docs.map(d => ({ qty: d.data().quantity, ts: d.data().timestamp }))
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      } else if (type === 'Used') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'job_usage'), where('productId', '==', stock.productId)))
        let rows = snap.docs
          .filter(d => !d.data().technicianId || d.data().technicianId === stock.technicianId)
          .map(d => ({ qty: d.data().usedQuantity || d.data().quantity || 0, ts: d.data().timestamp, label: d.data().jobId || '' }))
        if (rows.length === 0 && (stock.usedQuantity || 0) > 0) {
          rows = [{ qty: stock.usedQuantity, ts: stock.lastUpdated || stock.takenAt, legacy: true }]
        }
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      } else if (type === 'Returned') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('productId', '==', stock.productId), where('technicianId', '==', stock.technicianId)))
        const rows = snap.docs
          .filter(d => ['technician_return', 'return_verified'].includes(d.data().type))
          .map(d => ({ qty: d.data().quantity, ts: d.data().timestamp, label: d.data().type === 'return_verified' ? 'Verified' : 'Returned' }))
        rows.sort((a, b) => (b.ts?.seconds || 0) - (a.ts?.seconds || 0))
        setDrillData(rows)
      } else if (type === 'Damaged') {
        const snap = await getDocs(query(collection(db, 'stock_transactions'), where('type', '==', 'damaged'), where('productId', '==', stock.productId)))
        let rows = snap.docs
          .filter(d => !d.data().technicianId || d.data().technicianId === stock.technicianId)
          .map(d => ({ qty: d.data().quantity, ts: d.data().timestamp, charge: d.data().damageCharge }))
        if (rows.length === 0 && (stock.damagedQuantity || 0) > 0) {
          rows = [{ qty: stock.damagedQuantity, ts: stock.lastUpdated || stock.takenAt, legacy: true }]
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

  const openAssignModal = () => {
    setAssignAddedItems([])
    setAssignSelectedCategory('')
    setAssignCurrentProduct('')
    setAssignCurrentQuantity('')
    setAssignEditingId(null)
    setShowAssignModal(true)
  }

  const assignAddProduct = () => {
    if (!assignCurrentProduct || !assignCurrentQuantity) {
      toast.error('Select a product and enter quantity')
      return
    }
    if (Number(assignCurrentQuantity) <= 0) {
      toast.error('Quantity must be greater than 0')
      return
    }
    const product = assignProducts.find(p => p.id === assignCurrentProduct)
    const existingStock = techStock.find(s => s.productId === assignCurrentProduct)
    const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - (existingStock.damagedQuantity || 0)) : 0
    const requestedQty = Number(assignCurrentQuantity)

    if (currentHolding + requestedQty > MAX_PER_PRODUCT) {
      toast.error(`Limit exceeded. Currently holding ${currentHolding}. Max: ${MAX_PER_PRODUCT}`)
      return
    }

    if (assignEditingId) {
      setAssignAddedItems(assignAddedItems.map(i => i.productId === assignEditingId ? { ...i, quantity: assignCurrentQuantity } : i))
      setAssignEditingId(null)
    } else {
      if (assignAddedItems.find(i => i.productId === assignCurrentProduct)) {
        toast.error('Already added. Click item to edit.')
        return
      }
      setAssignAddedItems([...assignAddedItems, { productId: assignCurrentProduct, productName: product.name, quantity: assignCurrentQuantity, category: product.category || 'Uncategorized' }])
    }
    setAssignCurrentProduct('')
    setAssignCurrentQuantity('')
    setAssignSelectedCategory('')
    toast.success(`${product.name} added`)
  }

  const handleAssignStock = async () => {
    if (assignAddedItems.length === 0) { toast.error('Add at least one product'); return }
    setAssigning(true)
    try {
      for (const row of assignAddedItems) {
        const qty = Number(row.quantity)
        const product = assignProducts.find(p => p.id === row.productId)
        const invRef = doc(db, 'inventory', row.productId)
        const invSnap = await getDoc(invRef)
        const currentQty = invSnap.exists() ? (invSnap.data().quantity || 0) : 0

        if (currentQty < qty) {
          toast.error(`Insufficient stock for "${product.name}". Available: ${currentQty}`)
          setAssigning(false)
          return
        }

        await updateDoc(invRef, { quantity: currentQty - qty, lastUpdated: serverTimestamp() })

        const existingStock = techStock.find(s => s.productId === row.productId)
        if (existingStock) {
          await updateDoc(doc(db, 'technician_stock', existingStock.id), {
            takenQuantity: existingStock.takenQuantity + qty,
            lastTakenAt: serverTimestamp(),
          })
        } else {
          await addDoc(collection(db, 'technician_stock'), {
            technicianId: selectedTech,
            technicianName: selectedTechData?.name || 'Technician',
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

        await addDoc(collection(db, 'stock_transactions'), {
          type: 'technician_take',
          productId: row.productId,
          productName: product.name,
          quantity: qty,
          toUser: selectedTechData?.name || 'Technician',
          technicianId: selectedTech,
          assignedByAdmin: true,
          timestamp: serverTimestamp(),
        })
      }

      toast.success(`✅ Stock assigned to ${selectedTechData?.name}`)
      setShowAssignModal(false)
      setAssignAddedItems([])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAssigning(false)
    }
  }

  const selectedTechData = technicians.find(t => t.id === selectedTech)

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div
        className="flex items-center justify-center px-4 py-4 rounded-full mx-4 mb-5 relative"
        style={isDark ? {
          background: '#151B2B',
          boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
        } : {
          background: '#e8f0f7',
          boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
        }}
      >
        <button
          onClick={() => window.history.back()}
          className={`absolute left-4 p-2 rounded-lg transition-all ${
            isDark
              ? 'hover:bg-white/10 text-white/70 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold pl-10 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          TECHNICIAN STOCK
        </h1>
      </div>

      <div className="space-y-5">
      {/* Header - removed old header section */}

      {/* Select Technician */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5"
        style={isDark ? {
          background: '#151B2B',
          boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
        } : {
          background: '#e8f0f7',
          boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
        }}
      >
        <label className={`text-xs font-bold uppercase tracking-wider block mb-3 ${
          isDark ? 'text-white/60' : 'text-gray-500'
        }`}>
          Select Technician
        </label>
        <select
          value={selectedTech}
          onChange={e => setSelectedTech(e.target.value)}
          className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
          style={isDark ? {
            background: '#151B2B',
            boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)'
          } : {
            background: '#e8f0f7',
            boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)'
          }}
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
          className="rounded-2xl overflow-hidden"
          style={isDark ? {
            background: '#151B2B',
            boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
          } : {
            background: '#e8f0f7',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
          }}
        >
          <div
            className="px-5 py-4"
            style={isDark
              ? { background: '#0B0F19', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
              : { background: '#dce6f0', boxShadow: '0 2px 6px rgba(163,177,198,0.4)' }
            }
          >
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Stock Overview</p>
                <h3 className={`text-lg font-black mt-0.5 ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedTechData?.name}</h3>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={openAssignModal}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition ${
                  isDark ? 'text-cyan-300' : 'text-cyan-700'
                }`}
                style={isDark
                  ? { background: '#151B2B', boxShadow: '-3px -3px 8px rgba(255,255,255,0.04), 4px 4px 10px rgba(0,0,0,0.6)' }
                  : { background: '#e8f0f7', boxShadow: '-4px -4px 8px rgba(255,255,255,0.9), 4px 4px 8px rgba(163,177,198,0.5)' }
                }
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Assign Stock
              </motion.button>
            </div>
          </div>

          {techStock.length === 0 ? (
            <div className="p-8 text-center">
              <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
                No active stock for this technician
              </p>
            </div>
          ) : (
            <div className="p-5 space-y-3">
              {techStock
                .sort((a, b) => {
                  const pendA = (a.takenQuantity||0)-(a.usedQuantity||0)-(a.returnedQuantity||0)-(a.damagedQuantity||0)
                  const pendB = (b.takenQuantity||0)-(b.usedQuantity||0)-(b.returnedQuantity||0)-(b.damagedQuantity||0)
                  return pendB - pendA
                })
                .map((stock, idx) => {
                const taken = stock.takenQuantity || 0
                const used = stock.usedQuantity || 0
                const returned = stock.returnedQuantity || 0
                const damaged = stock.damagedQuantity || 0
                const pending = taken - used - returned - damaged
                const isZero = pending === 0
                const product = products.find(p => p.id === stock.productId)

                return (
                  <motion.div
                    key={stock.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className={`rounded-xl p-4 ${isZero ? 'opacity-60' : ''}`}
                    style={isDark ? {
                      background: '#151B2B',
                      boxShadow: '-3px -3px 8px rgba(255,255,255,0.04), 3px 3px 8px rgba(0,0,0,0.6)'
                    } : {
                      background: '#e8f0f7',
                      boxShadow: '-4px -4px 8px rgba(255,255,255,0.9), 4px 4px 8px rgba(163,177,198,0.5)'
                    }}
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
                          {pending}
                        </span>
                      )}
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[
                        { label: 'Taken', value: taken, textColor: isZero ? isDark ? 'text-gray-500' : 'text-gray-400' : isDark ? 'text-sky-300' : 'text-sky-700', bg: isZero ? '' : isDark ? 'rgba(56,189,248,0.08)' : 'rgba(186,230,253,0.45)' },
                        { label: 'Used', value: used, textColor: isZero ? isDark ? 'text-gray-500' : 'text-gray-400' : isDark ? 'text-teal-300' : 'text-teal-700', bg: isZero ? '' : isDark ? 'rgba(45,212,191,0.08)' : 'rgba(153,246,228,0.45)' },
                        { label: 'Returned', value: returned, textColor: isZero ? isDark ? 'text-gray-500' : 'text-gray-400' : isDark ? 'text-violet-300' : 'text-violet-700', bg: isZero ? '' : isDark ? 'rgba(167,139,250,0.08)' : 'rgba(221,214,254,0.45)' },
                        { label: 'Damaged', value: damaged, textColor: isZero ? isDark ? 'text-gray-500' : 'text-gray-400' : isDark ? 'text-rose-300' : 'text-rose-700', bg: isZero ? '' : isDark ? 'rgba(251,113,133,0.08)' : 'rgba(254,205,211,0.45)' },
                      ].map(stat => (
                        <button
                          key={stat.label}
                          onClick={() => openDrill(stat.label, stock)}
                          className={`text-center p-2 rounded-lg active:scale-95 transition-all ${stat.textColor}`}
                          style={isDark
                            ? { background: stat.bg || '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                            : { background: stat.bg || '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                          }>
                          <p className="text-base font-black">{stat.value}</p>
                          <p className="text-[9px] font-semibold opacity-70">{stat.label}</p>
                        </button>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      {pending > 0 && (
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={() => openReturnModal(stock)}
                          disabled={verifying}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold transition disabled:opacity-50 ${
                            isDark ? 'text-cyan-300' : 'text-cyan-700'
                          }`}
                          style={isDark ? {
                            background: '#151B2B',
                            boxShadow: '-3px -3px 8px rgba(255,255,255,0.04), 4px 4px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)'
                          } : {
                            background: '#e8f0f7',
                            boxShadow: '-4px -4px 8px rgba(255,255,255,0.9), 4px 4px 8px rgba(163,177,198,0.5)'
                          }}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Verify Return
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${isDark ? 'text-cyan-200' : 'text-cyan-800'}`}
                            style={isDark
                              ? { background: '#0B0F19', boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)' }
                              : { background: '#e8f0f7', boxShadow: 'inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)' }
                            }
                          >{pending}</span>
                        </motion.button>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

{/* Return Verification Modal */}
      {showReturnModal && selectedStock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl max-w-md w-full overflow-hidden"
            style={isDark ? {
              background: '#151B2B',
            } : {
              background: '#e8f0f7',
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4"
              style={isDark
                ? { background: '#0B0F19', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
                : { background: '#dce6f0', boxShadow: '0 2px 6px rgba(163,177,198,0.4)' }
              }
            >
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
              <div
                className="rounded-xl p-4"
                style={isDark
                  ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                  : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                }
              >
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
                  className={`w-full rounded-xl px-4 py-3 text-lg font-bold text-center focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
                  style={isDark
                    ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                    : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                  }
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
            <div
              className="px-6 py-4 flex gap-3"
              style={isDark
                ? { background: '#0B0F19', boxShadow: '0 -2px 6px rgba(0,0,0,0.4)' }
                : { background: '#dce6f0', boxShadow: '0 -2px 6px rgba(163,177,198,0.3)' }
              }
            >
              <button
                onClick={() => {
                  setShowReturnModal(false)
                  setReturnQuantity('')
                  setSelectedStock(null)
                }}
                disabled={verifying}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition disabled:opacity-50 ${isDark ? 'text-white/60' : 'text-gray-600'}`}
                style={isDark
                  ? { background: '#151B2B', boxShadow: '-3px -3px 7px rgba(255,255,255,0.04), 3px 3px 7px rgba(0,0,0,0.6)' }
                  : { background: '#e8f0f7', boxShadow: '-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.5)' }
                }
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyReturn}
                disabled={verifying || !returnQuantity}
                className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition disabled:opacity-50 disabled:cursor-not-allowed`}
                style={isDark ? {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '-3px -3px 8px rgba(255,255,255,0.04), 4px 4px 10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)'
                } : {
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  boxShadow: '-4px -4px 8px rgba(255,255,255,0.6), 4px 4px 8px rgba(5,150,105,0.4)'
                }}
              >
                {verifying ? 'Verifying...' : '✅ Verify Return'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
      </div>

      {/* Assign Stock Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex justify-center p-4" style={{ alignItems: 'flex-start', paddingTop: '8vh' }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAssignModal(false)} />
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              className="relative w-full max-w-md rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
              style={isDark
                ? { background: '#151B2B' }
                : { background: '#e8f0f7' }
              }
            >
              {/* Modal Header */}
              <div
                className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                style={isDark
                  ? { background: '#0B0F19', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
                  : { background: '#dce6f0', boxShadow: '0 2px 6px rgba(163,177,198,0.4)' }
                }
              >
                <div>
                  <h3 className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>Assign Stock</h3>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>To: {selectedTechData?.name}</p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${isDark ? 'bg-white/10 text-white/60' : 'bg-gray-200 text-gray-500'}`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Modal Body */}
              <div className="overflow-y-auto flex-1 p-5 space-y-4">
                {/* Category */}
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Choose Category</label>
                  <select
                    value={assignSelectedCategory}
                    onChange={e => { setAssignSelectedCategory(e.target.value); setAssignCurrentProduct('') }}
                    className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
                    style={isDark
                      ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                      : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                    }
                  >
                    <option value="" className="text-gray-900">Select a category...</option>
                    {assignCategories.map(cat => <option key={cat} value={cat} className="text-gray-900">{cat}</option>)}
                  </select>
                </div>

                {/* Product */}
                {assignSelectedCategory && (
                  <div>
                    <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Select Product</label>
                    <select
                      value={assignCurrentProduct}
                      onChange={e => setAssignCurrentProduct(e.target.value)}
                      className={`w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
                      style={isDark
                        ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                        : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                      }
                    >
                      <option value="" className="text-gray-900">Select a product...</option>
                      {assignProducts
                        .filter(p => (p.category || 'Uncategorized') === assignSelectedCategory)
                        .filter(p => !assignAddedItems.filter(i => i.productId !== assignEditingId).map(i => i.productId).includes(p.id))
                        .map(p => <option key={p.id} value={p.id} className="text-gray-900">{p.name}</option>)
                      }
                    </select>
                  </div>
                )}

                {/* Quantity */}
                {assignCurrentProduct && (
                  <div>
                    <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>Enter Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={assignCurrentQuantity}
                      onChange={e => setAssignCurrentQuantity(e.target.value)}
                      placeholder="Enter quantity"
                      className={`w-full rounded-xl px-3 py-2.5 text-sm text-center font-bold focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
                      style={isDark
                        ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                        : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                      }
                    />
                    {(() => {
                      const product = assignProducts.find(p => p.id === assignCurrentProduct)
                      const availableQty = product?.quantity || 0
                      const requestedQty = Number(assignCurrentQuantity) || 0
                      const existingStock = techStock.find(s => s.productId === assignCurrentProduct)
                      const currentHolding = existingStock ? (existingStock.takenQuantity - existingStock.usedQuantity - existingStock.returnedQuantity - (existingStock.damagedQuantity || 0)) : 0
                      if (requestedQty > 0) {
                        if (requestedQty > availableQty)
                          return <p className={`text-xs mt-2 text-center ${isDark ? 'text-red-400' : 'text-red-600'}`}>❌ Only {availableQty} units available</p>
                        if (currentHolding + requestedQty > MAX_PER_PRODUCT)
                          return <p className={`text-xs mt-2 text-center ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>⚠️ Limit exceeded. Holding: {currentHolding}, Max: {MAX_PER_PRODUCT}</p>
                        return <p className={`text-xs mt-2 text-center ${isDark ? 'text-green-400' : 'text-green-600'}`}>✅ Available in inventory: {availableQty}</p>
                      }
                    })()}
                  </div>
                )}

                {/* Add button */}
                {assignCurrentProduct && assignCurrentQuantity && (
                  <button
                    onClick={assignAddProduct}
                    className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
                    style={isDark
                      ? { background: '#151B2B', boxShadow: '-3px -3px 8px rgba(255,255,255,0.04), 4px 4px 10px rgba(0,0,0,0.6)' }
                      : { background: '#e8f0f7', boxShadow: '-4px -4px 8px rgba(255,255,255,0.9), 4px 4px 8px rgba(163,177,198,0.5)' }
                    }
                  >
                    {assignEditingId ? '✓ Update Product' : '✓ Add Product'}
                  </button>
                )}

                {/* Added items */}
                {assignAddedItems.length > 0 && (
                  <div
                    className="rounded-2xl p-4 space-y-2"
                    style={isDark
                      ? { background: '#0B0F19', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                      : { background: '#dce6f0', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                    }
                  >
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Added Items ({assignAddedItems.length})</p>
                    {assignAddedItems.map(item => (
                      <div
                        key={item.productId}
                        onClick={() => { setAssignEditingId(item.productId); setAssignCurrentProduct(item.productId); setAssignCurrentQuantity(item.quantity); setAssignSelectedCategory(item.category) }}
                        className={`flex items-center justify-between p-3 rounded-xl cursor-pointer ${isDark ? 'bg-white/5' : 'bg-white/60'}`}
                      >
                        <div>
                          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.productName}</p>
                          <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{item.category} • Qty: {item.quantity}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); setAssignAddedItems(assignAddedItems.filter(i => i.productId !== item.productId)) }}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center text-lg font-bold ${isDark ? 'text-red-400 bg-red-500/10' : 'text-red-500 bg-red-50'}`}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              {assignAddedItems.length > 0 && (
                <div
                  className="px-5 py-4 flex-shrink-0"
                  style={isDark
                    ? { background: '#0B0F19', boxShadow: '0 -2px 6px rgba(0,0,0,0.4)' }
                    : { background: '#dce6f0', boxShadow: '0 -2px 6px rgba(163,177,198,0.3)' }
                  }
                >
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAssignStock}
                    disabled={assigning}
                    className="w-full rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-60"
                    style={{ background: 'linear-gradient(135deg, #0e7490, #0891b2)', boxShadow: isDark ? '4px 4px 10px rgba(0,0,0,0.5), -3px -3px 8px rgba(6,182,212,0.1)' : '4px 4px 10px #7dd3e8, -3px -3px 8px #ffffff' }}
                  >
                    {assigning ? '⏳ Assigning...' : `📤 Assign Stock (${assignAddedItems.length} items)`}
                  </motion.button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className={`relative w-full max-w-sm rounded-2xl overflow-hidden ${
                isDark ? 'bg-dark-card' : 'bg-white'
              }`}
            >
              <div className={`flex items-center justify-between px-4 py-3 border-b ${
                isDark ? 'border-white/10' : 'border-gray-100'
              }`}>
                <div>
                  <p className={`font-black text-base ${
                    drillModal.type === 'Taken' ? isDark ? 'text-blue-300' : 'text-blue-600' :
                    drillModal.type === 'Used' ? isDark ? 'text-green-300' : 'text-green-600' :
                    drillModal.type === 'Returned' ? isDark ? 'text-purple-300' : 'text-purple-600' :
                    isDark ? 'text-red-300' : 'text-red-600'
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
              <div className="max-h-72 overflow-y-auto px-4 py-3 space-y-2">
                {drillLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin opacity-40" />
                  </div>
                ) : drillData.length === 0 ? (
                  <p className={`text-center py-8 text-sm ${isDark ? 'text-white/30' : 'text-gray-400'}`}>No records found</p>
                ) : (
                  drillData.map((row, i) => (
                    <div key={i} className={`rounded-xl px-3 py-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg ${
                          drillModal.type === 'Taken' ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700' :
                          drillModal.type === 'Used' ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' :
                          drillModal.type === 'Returned' ? isDark ? 'bg-purple-500/20 text-purple-300' : 'bg-purple-100 text-purple-700' :
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
                          drillModal.type === 'Returned' ? isDark ? 'text-purple-300' : 'text-purple-600' :
                          isDark ? 'text-red-300' : 'text-red-600'
                        }`}>{row.qty} <span className="text-xs font-medium opacity-60">units</span></span>
                      </div>
                      {row.label && <p className={`text-xs mt-1.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{row.label}</p>}
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
    </div>
  )
}
