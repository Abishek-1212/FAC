import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from './Modal'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

export default function InvoiceModal({ open, onClose, job, isDark, onInvoiceSaved }) {
  const [completionReport, setCompletionReport] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [invoiceSaved, setInvoiceSaved] = useState(false)
  const [savedInvoiceData, setSavedInvoiceData] = useState(null)
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false)
  const [personalStock, setPersonalStock] = useState([])
  const [allProducts, setAllProducts] = useState([])
  const [expandedStockItems, setExpandedStockItems] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  
  // Initialize state from localStorage or defaults
  const getInitialFormData = () => {
    if (!job?.id) return {
      totalAmount: 0,
      discountType: 'percentage',
      discountValue: 0,
      paymentType: 'Cash',
      personalStockUsage: []
    }
    
    const savedFormKey = `invoice_draft_${job.id}`
    const savedData = localStorage.getItem(savedFormKey)
    
    if (savedData) {
      try {
        return JSON.parse(savedData)
      } catch (err) {
        console.error('Error loading saved invoice draft:', err)
      }
    }
    
    return {
      totalAmount: 0,
      discountType: 'percentage',
      discountValue: 0,
      paymentType: 'Cash',
      personalStockUsage: []
    }
  }
  
  const [totalAmount, setTotalAmount] = useState(() => getInitialFormData().totalAmount)
  const [discountType, setDiscountType] = useState(() => getInitialFormData().discountType)
  const [discountValue, setDiscountValue] = useState(() => getInitialFormData().discountValue)
  const [paymentType, setPaymentType] = useState(() => getInitialFormData().paymentType)
  const [personalStockUsage, setPersonalStockUsage] = useState(() => getInitialFormData().personalStockUsage)

  // Load saved form data from localStorage when job changes
  useEffect(() => {
    if (!open || !job?.id) return
    
    const savedFormKey = `invoice_draft_${job.id}`
    const savedData = localStorage.getItem(savedFormKey)
    
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData)
        setTotalAmount(parsed.totalAmount || 0)
        setDiscountType(parsed.discountType || 'percentage')
        setDiscountValue(parsed.discountValue || 0)
        setPaymentType(parsed.paymentType || 'Cash')
        setPersonalStockUsage(parsed.personalStockUsage || [])
        // All items start expanded by default
        const expandedSet = new Set()
        parsed.personalStockUsage?.forEach((_, index) => {
          expandedSet.add(index)
        })
        setExpandedStockItems(expandedSet)
      } catch (err) {
        console.error('Error loading saved invoice draft:', err)
      }
    }
  }, [job?.id]) // Only depend on job.id, not open

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (!job?.id || invoiceSaved) return
    
    const savedFormKey = `invoice_draft_${job.id}`
    const formData = {
      totalAmount,
      discountType,
      discountValue,
      paymentType,
      personalStockUsage
    }
    
    localStorage.setItem(savedFormKey, JSON.stringify(formData))
  }, [job?.id, totalAmount, discountType, discountValue, paymentType, personalStockUsage, invoiceSaved])

  useEffect(() => {
    if (!open || !job?.id) return
    setLoading(true)
    
    // Load all products for dropdown
    const loadProducts = async () => {
      try {
        const productsSnapshot = await getDocs(collection(db, 'products'))
        const inventorySnapshot = await getDocs(collection(db, 'inventory'))
        
        const loadedProducts = productsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        const inventoryProducts = inventorySnapshot.docs.map(d => ({ id: d.id, ...d.data() }))
        
        // Merge products with inventory data to get categories
        const mergedProducts = loadedProducts.map(product => {
          const invProduct = inventoryProducts.find(inv => 
            inv.id === product.id || 
            inv.productName === product.name || 
            inv.name === product.name
          )
          return {
            ...product,
            category: invProduct?.category || product.category || 'Uncategorized'
          }
        })
        
        // Also add inventory products that might not be in products collection
        inventoryProducts.forEach(inv => {
          const exists = mergedProducts.find(p => 
            p.id === inv.id || 
            p.name === inv.productName || 
            p.name === inv.name
          )
          if (!exists) {
            mergedProducts.push({
              id: inv.id,
              name: inv.productName || inv.name,
              category: inv.category || 'Uncategorized',
              ...inv
            })
          }
        })
        
        setAllProducts(mergedProducts)
      } catch (err) {
        console.error('Error loading products:', err)
        toast.error('Failed to load products')
      }
    }
    loadProducts()
    
    // Load technician's personal stock - need to find technician UID from technicianName
    const loadPersonalStock = async () => {
      if (!job.technicianName) return
      
      try {
        // Find technician by name in users collection
        const usersQuery = query(
          collection(db, 'users'),
          where('name', '==', job.technicianName),
          where('role', '==', 'technician')
        )
        const usersSnap = await getDocs(usersQuery)
        
        if (usersSnap.empty) {
          console.log('No technician found with name:', job.technicianName)
          return
        }
        
        const technicianId = usersSnap.docs[0].id
        
        // Now load their stock
        const stockQuery = query(
          collection(db, 'technician_stock'),
          where('technicianId', '==', technicianId),
          where('status', '==', 'active')
        )
        const unsubStock = onSnapshot(stockQuery, snap => {
          const loadedStock = snap.docs.map(d => ({ 
            id: d.id, 
            ...d.data(),
            currentUnits: (d.data().takenQuantity || 0) - (d.data().usedQuantity || 0) - (d.data().returnedQuantity || 0)
          }))
          setPersonalStock(loadedStock)
        })
        
        return unsubStock
      } catch (error) {
        console.error('Error loading personal stock:', error)
      }
    }
    
    const stockUnsubPromise = loadPersonalStock()
    
    // Check if invoice already exists
    const checkInvoice = async () => {
      const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', job.id)))
      if (invoicesSnap.docs.length > 0) {
        const existingInvoice = invoicesSnap.docs[0].data()
        setInvoiceSaved(true)
        setSavedInvoiceData(existingInvoice)
      }
    }
    checkInvoice()
    
    const unsubscribe = onSnapshot(
      query(collection(db, 'job_completion_reports'), where('jobId', '==', job.id)),
      async (snap) => {
        try {
          if (snap.docs.length > 0) {
            const report = snap.docs[0].data()
            setCompletionReport(report)
            
            try {
              const productsSnapshot = await getDocs(collection(db, 'products'))
              const productsMap = {}
              productsSnapshot.docs.forEach(doc => {
                productsMap[doc.data().name] = doc.data().price
              })
              
              const itemsWithPrices = report.itemsSummary?.map(item => ({
                name: item.productName,
                qty: item.used,
              })) || []
              
              // Also check for personal stock usage
              const personalStockItems = report.personalStockUsage?.map(item => ({
                name: item.productName,
                qty: item.used,
              })) || []
              
              setProducts([...itemsWithPrices, ...personalStockItems])
            } catch (err) {
              console.warn('Could not fetch product prices:', err.message)
              const itemsWithoutPrices = report.itemsSummary?.map(item => ({
                name: item.productName,
                qty: item.used,
              })) || []
              
              const personalStockItems = report.personalStockUsage?.map(item => ({
                name: item.productName,
                qty: item.used,
              })) || []
              
              setProducts([...itemsWithoutPrices, ...personalStockItems])
            }
          }
        } catch (err) {
          console.error('Error in invoice modal:', err)
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        console.error('Firestore error:', err)
        setLoading(false)
      }
    )
    
    return () => {
      unsubscribe()
      if (stockUnsubPromise) stockUnsubPromise.then(unsub => unsub && unsub())
    }
  }, [open, job?.id])

  const calculateDiscount = () => {
    const amount = parseFloat(totalAmount) || 0
    const discount = parseFloat(discountValue) || 0
    
    if (discountType === 'percentage') {
      return (amount * discount) / 100
    }
    return discount
  }

  const discountAmount = calculateDiscount()
  const grandTotal = (parseFloat(totalAmount) || 0) - discountAmount

  const addPersonalStockItem = () => {
    const newIndex = personalStockUsage.length
    setPersonalStockUsage([...personalStockUsage, { productId: '', productName: '', currentUnits: 0, used: '', damaged: '' }])
    // Auto-expand new items
    setExpandedStockItems(prev => new Set([...prev, newIndex]))
  }

  const removePersonalStockItem = (index) => {
    setPersonalStockUsage(personalStockUsage.filter((_, i) => i !== index))
    // Remove from expanded set and adjust indices
    const newExpanded = new Set()
    expandedStockItems.forEach(i => {
      if (i < index) newExpanded.add(i)
      else if (i > index) newExpanded.add(i - 1)
    })
    setExpandedStockItems(newExpanded)
  }

  const updatePersonalStockItem = (index, field, value) => {
    const updated = [...personalStockUsage]
    if (field === 'productId') {
      const product = allProducts.find(p => p.id === value)
      const stock = personalStock.find(s => s.productId === value)
      updated[index] = {
        ...updated[index],
        productId: value,
        productName: product?.name || stock?.productName || '',
        currentUnits: stock?.currentUnits || 0
      }
    } else {
      updated[index][field] = value
    }
    setPersonalStockUsage(updated)
  }

  const toggleStockItem = (index) => {
    const newExpanded = new Set(expandedStockItems)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedStockItems(newExpanded)
  }

  const handleGenerateInvoice = async () => {
    setSaving(true)
    try {
      // Validate personal stock usage if any
      for (const item of personalStockUsage) {
        if (!item.productId) {
          toast.error('Please select a product for all personal stock items')
          setSaving(false)
          return
        }
        const used = Number(item.used) || 0
        const damaged = Number(item.damaged) || 0
        if (used === 0 && damaged === 0) {
          toast.error('Please enter used or damaged quantity for all personal stock items')
          setSaving(false)
          return
        }
        if (used + damaged > item.currentUnits) {
          toast.error(`${item.productName}: Total exceeds available units (${item.currentUnits})`)
          setSaving(false)
          return
        }
      }

      const billNo = `FAC-${Date.now()}`
      const billAmount = grandTotal
      
      // Combine products from completion report and personal stock usage (only used items for invoice)
      const allUsedProducts = [
        ...products,
        ...personalStockUsage.map(item => ({ name: item.productName, qty: Number(item.used) || 0 }))
      ]
      
      const invoiceData = {
        billNo,
        jobId: job.id || '',
        customerName: job.customerName || 'N/A',
        customerPhone: job.customerPhone || 'N/A',
        customerAddress: job.customerAddress || 'N/A',
        technicianId: job.technicianId || '',
        technicianName: job.technicianName || 'N/A',
        serviceType: job.serviceType || 'N/A',
        components: allUsedProducts.map(p => ({ name: p.name || 'N/A', quantity: p.qty || 0 })),
        totalAmount: parseFloat(totalAmount) || 0,
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        discountAmount,
        billAmount,
        amountReceived: billAmount,
        paymentPending: 0,
        modeOfPayment: paymentType,
        invoiceDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        submittedByTechnician: true,
        adminViewed: false,
        generatedDate: serverTimestamp(),
        invoiceNumber: billNo,
        createdAt: serverTimestamp(),
      }

      await addDoc(collection(db, 'invoices'), invoiceData)
      
      // Update personal stock if used
      if (personalStockUsage.length > 0) {
        for (const item of personalStockUsage) {
          const used = Number(item.used) || 0
          const damaged = Number(item.damaged) || 0
          const stockEntry = personalStock.find(s => s.productId === item.productId)
          
          if (stockEntry) {
            await updateDoc(doc(db, 'technician_stock', stockEntry.id), {
              usedQuantity: (stockEntry.usedQuantity || 0) + used,
              damagedQuantity: (stockEntry.damagedQuantity || 0) + damaged,
              lastUpdated: serverTimestamp(),
            })

            // Log transaction
            await addDoc(collection(db, 'stock_transactions'), {
              type: 'job_usage',
              jobId: job.id,
              technicianId: job.technicianId,
              technicianName: job.technicianName,
              productId: item.productId,
              productName: item.productName,
              usedQuantity: used,
              damagedQuantity: damaged,
              timestamp: serverTimestamp(),
            })
          }
        }
      }
      
      // Clear localStorage draft after successful save
      const savedFormKey = `invoice_draft_${job.id}`
      localStorage.removeItem(savedFormKey)
      
      setInvoiceSaved(true)
      setSavedInvoiceData(invoiceData)
      
      if (onInvoiceSaved) {
        onInvoiceSaved()
      }
      
      toast.success('✅ Invoice saved successfully!')
      setSaving(false)
      setShowSaveConfirmation(false)
      return billNo
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
      setShowSaveConfirmation(false)
      return null
    }
  }

  const handleShareInvoice = async () => {
    setSharing(true)
    try {
      const billNo = await handleGenerateInvoice()
      if (!billNo) { setSharing(false); return }

      const phone = job.customerPhone.replace(/\D/g, '')
      const message = `Hi ${job.customerName}, your invoice for ${job.serviceType} service is ready. Invoice #${billNo}`
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      
      window.open(whatsappUrl, '_blank')
      toast.success('✅ Invoice shared!')
      
      setTimeout(() => { onClose() }, 1500)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title="" size="lg">
      <div className={`space-y-4 md:space-y-6 scrollbar-hide overflow-y-auto max-h-[80vh] ${
        isDark ? 'bg-gradient-to-b from-gray-900 to-gray-800' : 'bg-gradient-to-b from-gray-50 to-white'
      }`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 ${isDark ? 'bg-gradient-to-r from-cyan-600 to-blue-600' : 'bg-gradient-to-r from-cyan-500 to-blue-600'} text-white`}>
              <div className="space-y-3 md:space-y-4">
                <div>
                  <p className="text-white/80 text-xs md:text-sm font-medium">Invoice Generation</p>
                  <h2 className="text-xl md:text-3xl font-black mt-1 break-words">📄 {job.customerName}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 text-xs md:text-sm">
                  <div>
                    <p className="text-white/60 text-xs">📞 Phone</p>
                    <p className="font-semibold mt-1 break-words">{job.customerPhone}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">🛠️ Service</p>
                    <p className="font-semibold mt-1">{job.serviceType}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-white/60 text-xs">📍 Address</p>
                    <p className="font-semibold mt-1 break-words text-xs md:text-sm">{job.customerAddress}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Section - Only show if there are products from completion report */}
            {products.length > 0 && (
              <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <h3 className={`text-base md:text-lg font-bold mb-3 md:mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>📦 Products Used</h3>
                
                <div className="space-y-2 md:space-y-3 overflow-x-auto">
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-2">
                    {products.map((product, idx) => (
                      <div key={idx} className={`rounded-lg p-3 space-y-2 ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700'}`}>{idx + 1}</span>
                          <div className="flex-1">
                            <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                            <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Quantity: <span className={`font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>{product.qty}</span></p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <div className={`grid grid-cols-12 gap-3 pb-3 border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="col-span-2">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>S.No</p>
                      </div>
                      <div className="col-span-7">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Product</p>
                      </div>
                      <div className="col-span-3 text-center">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Quantity</p>
                      </div>
                    </div>

                    {products.map((product, idx) => (
                      <div key={idx} className={`grid grid-cols-12 gap-3 py-3 px-3 rounded-lg mb-2 ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}>
                        <div className="col-span-2">
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700'}`}>{idx + 1}</span>
                        </div>
                        <div className="col-span-7">
                          <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                        </div>
                        <div className="col-span-3 text-center">
                          <p className={`font-bold text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>{product.qty}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Personal Stock Usage Section */}
            {!invoiceSaved && (
              <div className={`rounded-xl md:rounded-2xl p-4 md:p-5 border ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className={`text-sm md:text-base font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>🔧 Personal Stock Usage</h3>
                  <button
                    onClick={addPersonalStockItem}
                    className={`text-xs font-bold px-2.5 py-1.5 rounded-lg transition ${
                      isDark ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-cyan-500 text-white hover:bg-cyan-600'
                    }`}
                  >
                    + Add
                  </button>
                </div>
                
                {personalStockUsage.length > 0 ? (
                  <div className="space-y-2">
                    {personalStockUsage.map((item, index) => {
                      const isExpanded = expandedStockItems.has(index)
                      const hasProduct = item.productId && item.productName
                      
                      return (
                        <div key={index} className={`rounded-lg border transition-all ${
                          isDark ? 'bg-gray-700/50 border-gray-600' : 'bg-gray-50 border-gray-200'
                        }`}>
                          {/* Collapsed View */}
                          {!isExpanded && (
                            <div 
                              onClick={() => toggleStockItem(index)}
                              className={`p-3 cursor-pointer hover:bg-opacity-80 transition`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${isDark ? 'bg-cyan-600 text-white' : 'bg-cyan-100 text-cyan-700'}`}>#{index + 1}</span>
                                  <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.productName || 'Select product'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasProduct && (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      {(Number(item.used) || 0) > 0 && (
                                        <span className={`px-2 py-0.5 rounded font-bold ${isDark ? 'bg-emerald-600/30 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                                          ✓ {item.used}
                                        </span>
                                      )}
                                      {(Number(item.damaged) || 0) > 0 && (
                                        <span className={`px-2 py-0.5 rounded font-bold ${isDark ? 'bg-red-600/30 text-red-300' : 'bg-red-100 text-red-700'}`}>
                                          ✕ {item.damaged}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      removePersonalStockItem(index)
                                    }}
                                    className="text-red-500 hover:text-red-700 transition p-1"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expanded View */}
                          {isExpanded && (
                            <div className="p-3 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <p className={`text-xs font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>#{index + 1}</p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => removePersonalStockItem(index)}
                                    className="text-red-500 hover:text-red-700 transition"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              
                              {/* Product Dropdown */}
                              <div>
                                <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Product *</label>
                                <select
                                  value={item.productId}
                                  onChange={(e) => updatePersonalStockItem(index, 'productId', e.target.value)}
                                  className={`w-full px-2.5 py-2 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-200 text-gray-900'
                                  } border`}
                                >
                                  <option value="">Select product...</option>
                                  {(() => {
                                    const selectedProductIds = personalStockUsage
                                      .map((usageItem, idx) => idx !== index ? usageItem.productId : null)
                                      .filter(Boolean)
                                    
                                    const availableStock = personalStock.filter(stock => {
                                      return stock.currentUnits > 0 && (!selectedProductIds.includes(stock.productId) || stock.productId === item.productId)
                                    })
                                    
                                    if (availableStock.length === 0) {
                                      if (personalStock.length === 0) {
                                        return <option value="" disabled>No personal stock. Use "Take Stock" first.</option>
                                      } else {
                                        return <option value="" disabled>All stock used. Take more stock.</option>
                                      }
                                    }
                                    
                                    const grouped = {}
                                    availableStock.forEach(stock => {
                                      const product = allProducts.find(p => 
                                        p.id === stock.productId || 
                                        p.name === stock.productName || 
                                        p.productName === stock.productName
                                      )
                                      const category = product?.category || stock.category || 'Uncategorized'
                                      if (!grouped[category]) grouped[category] = []
                                      grouped[category].push({ 
                                        ...stock, 
                                        product: product || { 
                                          id: stock.productId, 
                                          name: stock.productName,
                                          category: category
                                        } 
                                      })
                                    })
                                    
                                    return Object.entries(grouped).map(([category, items]) => (
                                      <optgroup key={category} label={category}>
                                        {items.map(stock => (
                                          <option key={stock.productId} value={stock.productId}>
                                            {stock.product.name} ({stock.currentUnits} avail.)
                                          </option>
                                        ))}
                                      </optgroup>
                                    ))
                                  })()}
                                </select>
                                {personalStock.length === 0 && (
                                  <p className={`text-xs mt-1.5 flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    <span>⚠️</span>
                                    <span>No personal stock available. Go to "Take Stock" to get items from company inventory.</span>
                                  </p>
                                )}
                                {personalStock.length > 0 && personalStock.every(s => s.currentUnits === 0) && (
                                  <p className={`text-xs mt-1.5 flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>
                                    <span>⚠️</span>
                                    <span>All your stock has been used. Take more stock from inventory.</span>
                                  </p>
                                )}
                              </div>

                              {/* Current Units & Inputs */}
                              {item.productId && (
                                <>
                                  <div className={`rounded-lg p-2 text-center ${isDark ? 'bg-cyan-900/20 border border-cyan-700/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                                    <p className={`text-xs font-semibold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Available: <span className="text-lg font-black">{item.currentUnits}</span></p>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>✓ Used</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={item.currentUnits}
                                        placeholder="0"
                                        value={item.used}
                                        onChange={(e) => updatePersonalStockItem(index, 'used', e.target.value)}
                                        className={`w-full px-2.5 py-2 rounded-lg text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-emerald-300 ${
                                          isDark ? 'bg-gray-700 border-emerald-600 text-emerald-300' : 'bg-white border-emerald-200 text-emerald-700'
                                        } border`}
                                      />
                                    </div>
                                    <div>
                                      <label className={`text-xs font-semibold block mb-1 ${isDark ? 'text-red-300' : 'text-red-600'}`}>✕ Damaged</label>
                                      <input
                                        type="number"
                                        min={0}
                                        max={item.currentUnits}
                                        placeholder="0"
                                        value={item.damaged}
                                        onChange={(e) => updatePersonalStockItem(index, 'damaged', e.target.value)}
                                        className={`w-full px-2.5 py-2 rounded-lg text-xs text-center font-bold focus:outline-none focus:ring-2 focus:ring-red-300 ${
                                          isDark ? 'bg-gray-700 border-red-600 text-red-300' : 'bg-white border-red-200 text-red-700'
                                        } border`}
                                      />
                                    </div>
                                  </div>

                                  {/* Done Button */}
                                  <button
                                    onClick={() => toggleStockItem(index)}
                                    className={`w-full py-2 rounded-lg text-xs font-bold transition ${
                                      isDark ? 'bg-cyan-600 text-white hover:bg-cyan-700' : 'bg-cyan-500 text-white hover:bg-cyan-600'
                                    }`}
                                  >
                                    ✓ Done
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className={`text-center py-6 rounded-lg border-2 border-dashed ${
                    isDark ? 'border-gray-600' : 'border-gray-300'
                  }`}>
                    <p className="text-2xl mb-1">📦</p>
                    <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No items added</p>
                  </div>
                )}
              </div>
            )}

            {/* Total Amount & Payment Type Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <label className={`text-sm font-bold block mb-2 md:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>💵 Total Amount (₹)</label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="Enter total amount"
                  disabled={invoiceSaved}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-base md:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  } border disabled:opacity-50 disabled:cursor-not-allowed`}
                />
              </div>
              <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
                isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
              }`}>
                <label className={`text-sm font-bold block mb-2 md:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>💳 Payment Type</label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  disabled={invoiceSaved}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-base md:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  } border disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
            </div>

            {/* Discount Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <label className={`text-sm font-bold block mb-2 md:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>🏷️ Discount</label>
              
              {/* Discount Type Toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setDiscountType('percentage')}
                  disabled={invoiceSaved}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    discountType === 'percentage'
                      ? isDark
                        ? 'bg-cyan-600 text-white'
                        : 'bg-cyan-500 text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  % Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountType('amount')}
                  disabled={invoiceSaved}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed ${
                    discountType === 'amount'
                      ? isDark
                        ? 'bg-cyan-600 text-white'
                        : 'bg-cyan-500 text-white'
                      : isDark
                      ? 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ₹ Amount
                </button>
              </div>

              {/* Discount Value Input */}
              <div className="relative">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Enter discount %' : 'Enter discount amount'}
                  disabled={invoiceSaved}
                  className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-base md:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                    isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                  } border disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                <span className={`absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  {discountType === 'percentage' ? '%' : '₹'}
                </span>
              </div>

              {/* Discount Amount Display */}
              {discountAmount > 0 && (
                <div className={`mt-3 p-3 rounded-lg ${isDark ? 'bg-green-900/20 border border-green-700/30' : 'bg-green-50 border border-green-200'}`}>
                  <p className={`text-xs font-semibold ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                    Discount Applied: -₹{discountAmount.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Summary Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border-2 ${
              isDark ? 'bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-600/50' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-300'
            }`}>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center justify-between">
                  <p className={`text-xs md:text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Total Amount</p>
                  <p className={`text-sm md:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{(parseFloat(totalAmount) || 0).toFixed(2)}</p>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className={`text-xs md:text-sm font-semibold ${isDark ? 'text-green-300' : 'text-green-600'}`}>Discount ({discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}`})</p>
                    <p className={`text-sm md:text-lg font-bold ${isDark ? 'text-green-300' : 'text-green-600'}`}>-₹{discountAmount.toFixed(2)}</p>
                  </div>
                )}
                <div className={`border-t-2 pt-2 md:pt-3 ${isDark ? 'border-cyan-600/50' : 'border-cyan-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm md:text-lg font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Grand Total</p>
                    <p className={`text-xl md:text-3xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{grandTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-2 md:gap-3 pt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={onClose}
                className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold transition ${
                  isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                ✕ Close
              </motion.button>
              
              {/* Download Invoice Button - Always visible */}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  const billNo = savedInvoiceData?.billNo || `FAC-${Date.now()}`
                  
                  // Combine products from completion report and personal stock usage
                  const allInvoiceProducts = [
                    ...products,
                    ...personalStockUsage
                      .filter(item => item.productId && ((Number(item.used) || 0) > 0))
                      .map(item => ({ name: item.productName, qty: Number(item.used) || 0 }))
                  ]
                  
                  generateInvoice({
                    invoiceNumber: billNo,
                    customerName: job.customerName || 'N/A',
                    customerPhone: job.customerPhone || 'N/A',
                    customerAddress: job.customerAddress || 'N/A',
                    technicianName: job.technicianName || 'N/A',
                    serviceType: job.serviceType || 'N/A',
                    problemDescription: job.problemDescription || 'N/A',
                    totalAmount: parseFloat(totalAmount) || 0,
                    discountType,
                    discountValue: parseFloat(discountValue) || 0,
                    discountAmount,
                    grandTotal,
                    products: allInvoiceProducts,
                  })
                  toast.success('📥 Invoice downloaded!')
                }}
                className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white transition ${
                  isDark ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800' : 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
                }`}
              >
                📥 Download Invoice
              </motion.button>
              
              {/* Save Invoice Button - Only visible if not saved */}
              {!invoiceSaved && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowSaveConfirmation(true)}
                  disabled={saving || sharing}
                  className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white disabled:opacity-60 transition ${
                    isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                  }`}
                >
                  💾 Save Invoice
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>

    {/* Save Confirmation Modal */}
    {showSaveConfirmation && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !saving && setShowSaveConfirmation(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        
        {/* Confirmation Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className={`relative w-full max-w-md rounded-2xl p-6 shadow-2xl ${
            isDark ? 'bg-gray-800 border border-gray-700' : 'bg-white'
          }`}
        >
          <div className="text-center space-y-4">
            <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
              isDark ? 'bg-blue-500/20' : 'bg-blue-100'
            }`}>
              <svg className={`w-8 h-8 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            
            <div>
              <h3 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Save Invoice?
              </h3>
              <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Once saved, you cannot edit this invoice. Make sure all details are correct.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSaveConfirmation(false)}
                disabled={saving}
                className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${
                  isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } disabled:opacity-50`}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerateInvoice}
                disabled={saving}
                className={`flex-1 py-3 rounded-xl text-sm font-bold text-white transition disabled:opacity-60 ${
                  isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                {saving ? '⏳ Saving...' : '✓ Confirm Save'}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
    </>
  )
}
