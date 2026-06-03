import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from './Modal'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'
import { formatAddressForDisplay } from '../../utils/addressFormatter'

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
      personalStockUsage: [],
      amountReceived: ''
    }
  }
  
  const [totalAmount, setTotalAmount] = useState(() => getInitialFormData().totalAmount)
  const [discountType, setDiscountType] = useState(() => getInitialFormData().discountType)
  const [discountValue, setDiscountValue] = useState(() => getInitialFormData().discountValue)
  const [paymentType, setPaymentType] = useState(() => getInitialFormData().paymentType)
  const [personalStockUsage, setPersonalStockUsage] = useState(() => getInitialFormData().personalStockUsage)
  const [amountReceived, setAmountReceived] = useState(() => getInitialFormData().amountReceived || '')

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
        setAmountReceived(parsed.amountReceived || '')
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
      personalStockUsage,
      amountReceived
    }
    
    localStorage.setItem(savedFormKey, JSON.stringify(formData))
  }, [job?.id, totalAmount, discountType, discountValue, paymentType, personalStockUsage, amountReceived, invoiceSaved])

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
    // Validate amount received - must be provided
    if (amountReceived === '' || amountReceived === null || amountReceived === undefined) {
      toast.error('Amount Received is mandatory. Please enter the amount.')
      return
    }
    
    const receivedAmount = parseFloat(amountReceived)
    
    if (isNaN(receivedAmount) || receivedAmount < 0) {
      toast.error('Please enter a valid amount')
      return
    }
    
    if (receivedAmount > grandTotal) {
      toast.error(`Amount received cannot exceed Grand Total (₹${grandTotal.toFixed(2)})`)
      return
    }
    
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
      const finalAmountReceived = parseFloat(amountReceived)
      const pendingAmount = grandTotal - finalAmountReceived
      const paymentStatus = finalAmountReceived >= grandTotal ? 'Paid' : 'Pending'
      
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
        amountReceived: finalAmountReceived,
        paymentPending: pendingAmount,
        paymentStatus: paymentStatus,
        modeOfPayment: paymentType,
        invoiceDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        submittedByTechnician: true,
        adminViewed: false,
        updatedToAdmin: true,
        generatedDate: serverTimestamp(),
        invoiceNumber: billNo,
        createdAt: serverTimestamp(),
      }

      await addDoc(collection(db, 'invoices'), invoiceData)

      // If this is a follow-up job, update the original job's nextServiceDate to +3 months
      if (job.isFollowUp && job.originalJobId) {
        const newNextServiceDate = new Date()
        newNextServiceDate.setMonth(newNextServiceDate.getMonth() + 3)
        await updateDoc(doc(db, 'service_jobs', job.originalJobId), {
          nextServiceDate: newNextServiceDate,
          lastServicedAt: serverTimestamp(),
        })
      }

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
              jobId: job.id || '',
              technicianId: job.technicianId || '',
              technicianName: job.technicianName || '',
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
      
      const statusMessage = paymentStatus === 'Paid' 
        ? '✅ Invoice saved and updated to admin! Payment marked as Paid.' 
        : `✅ Invoice saved and updated to admin! Payment marked as Pending (₹${pendingAmount.toFixed(2)} remaining).`
      toast.success(statusMessage)
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

  const nm = {
    base:  { background: '#e8f4fb', borderRadius: '24px', boxShadow: '6px 6px 14px #c5d8e8, -6px -6px 14px #ffffff' },
    inset: { background: '#e8f4fb', borderRadius: '20px', boxShadow: 'inset 4px 4px 10px #c5d8e8, inset -3px -3px 8px #ffffff' },
    raised: { background: '#e8f4fb', borderRadius: '18px', boxShadow: '4px 4px 10px #c5d8e8, -3px -3px 8px #ffffff' },
  }

  return (
    <>
    <Modal open={open} onClose={onClose} title="Invoice Generation" size="lg">
      <div className="space-y-4 md:space-y-5 scrollbar-hide overflow-y-auto max-h-[80vh] pb-6" style={{ background: '#e8f4fb' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="rounded-2xl p-4 md:p-5" style={nm.inset}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Invoice Generation</p>
              <h2 className="text-xl font-black text-gray-800 flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-cyan-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                {job.customerName}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-xl p-3" style={nm.raised}>
                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    Phone
                  </p>
                  <p className="font-bold text-sm text-gray-700">{job.customerPhone}</p>
                </div>
                <div className="rounded-xl p-3" style={nm.raised}>
                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Service
                  </p>
                  <p className="font-bold text-sm text-gray-700">{job.serviceType}</p>
                </div>
                <div className="md:col-span-2 rounded-xl p-3" style={nm.raised}>
                  <p className="text-xs text-gray-400 font-semibold flex items-center gap-1 mb-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Address
                  </p>
                  <p className="font-bold text-sm text-gray-700 whitespace-pre-line">{formatAddressForDisplay(job.customerAddress)}</p>
                </div>
              </div>
            </div>

            {/* Products Section */}
            {products.length > 0 && (
              <div className="rounded-2xl p-4" style={nm.base}>
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                  Products Used
                </h3>
                <div className="space-y-2">
                  {products.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-xl px-3 py-2.5" style={nm.raised}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-cyan-600 w-5">{idx + 1}</span>
                        <p className="font-semibold text-sm text-gray-800">{product.name}</p>
                      </div>
                      <span className="text-sm font-black text-cyan-600">{product.qty}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personal Stock Usage Section */}
            {!invoiceSaved && (
              <div className="rounded-2xl p-4" style={nm.base}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Personal Stock Usage
                  </h3>
                  <button
                    onClick={addPersonalStockItem}
                    className="text-xs font-bold px-3 py-1.5 rounded-xl text-white border-0 transition-all"
                    style={{ background: 'linear-gradient(145deg, #06b6d4, #0891b2)', borderRadius: '16px', boxShadow: '3px 3px 8px #c5d8e8, -2px -2px 6px #ffffff' }}
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
                        <div key={index} className="rounded-xl overflow-hidden" style={nm.raised}>
                          {/* Collapsed */}
                          {!isExpanded && (
                            <div onClick={() => toggleStockItem(index)} className="p-3 cursor-pointer">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <span className="text-xs font-black text-cyan-600">#{index + 1}</span>
                                  <p className="text-sm font-bold text-gray-800 truncate">{item.productName || 'Select product'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {hasProduct && (
                                    <div className="flex items-center gap-1.5 text-xs">
                                      {(Number(item.used) || 0) > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg font-bold text-emerald-600" style={nm.inset}>{item.used}</span>
                                      )}
                                      {(Number(item.damaged) || 0) > 0 && (
                                        <span className="px-2 py-0.5 rounded-lg font-bold text-red-500" style={nm.inset}>{item.damaged}</span>
                                      )}
                                    </div>
                                  )}
                                  <button onClick={(e) => { e.stopPropagation(); removePersonalStockItem(index) }} className="text-red-400 hover:text-red-600 p-1">
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Expanded */}
                          {isExpanded && (
                            <div className="p-3 space-y-2.5">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-bold text-gray-400">#{index + 1}</p>
                                <button onClick={() => removePersonalStockItem(index)} className="text-red-400 hover:text-red-600">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                              </div>

                              <div>
                                <label className="text-xs font-semibold text-gray-500 block mb-1">Product *</label>
                                <select
                                  value={item.productId}
                                  onChange={(e) => updatePersonalStockItem(index, 'productId', e.target.value)}
                                  className="w-full px-2.5 py-2 rounded-xl text-xs focus:outline-none text-gray-800 border-0"
                                  style={nm.inset}
                                >
                                  <option value="">Select product...</option>
                                  {(() => {
                                    const selectedIds = personalStockUsage.map((u, i) => i !== index ? u.productId : null).filter(Boolean)
                                    const available = personalStock.filter(s => s.currentUnits > 0 && (!selectedIds.includes(s.productId) || s.productId === item.productId))
                                    if (available.length === 0) return <option disabled>{personalStock.length === 0 ? 'No personal stock. Use Take Stock first.' : 'All stock used.'}</option>
                                    const grouped = {}
                                    available.forEach(stock => {
                                      const product = allProducts.find(p => p.id === stock.productId || p.name === stock.productName)
                                      const cat = product?.category || stock.category || 'Uncategorized'
                                      if (!grouped[cat]) grouped[cat] = []
                                      grouped[cat].push({ ...stock, product: product || { id: stock.productId, name: stock.productName } })
                                    })
                                    return Object.entries(grouped).map(([cat, items]) => (
                                      <optgroup key={cat} label={cat}>
                                        {items.map(s => <option key={s.productId} value={s.productId}>{s.product.name} ({s.currentUnits} avail.)</option>)}
                                      </optgroup>
                                    ))
                                  })()}
                                </select>
                                {personalStock.length === 0 && (
                                  <p className="text-xs mt-1 text-amber-500 flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                                    No personal stock. Go to Take Stock first.
                                  </p>
                                )}
                              </div>

                              {item.productId && (() => {
                                const used = Number(item.used) || 0
                                const damaged = Number(item.damaged) || 0
                                const isExceeded = (used + damaged) > item.currentUnits
                                return (
                                  <>
                                    <div className="rounded-xl p-2 text-center" style={nm.inset}>
                                      <p className="text-xs font-semibold text-cyan-600">Available: <span className="text-base font-black">{item.currentUnits}</span></p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <label className="text-xs font-semibold text-emerald-600 block mb-1">Used</label>
                                        <input type="number" min={0} max={item.currentUnits} placeholder="0" value={item.used}
                                          onChange={(e) => updatePersonalStockItem(index, 'used', e.target.value)}
                                          className="w-full px-2.5 py-2 rounded-xl text-xs text-center font-bold focus:outline-none border-0 text-emerald-700"
                                          style={nm.inset} />
                                      </div>
                                      <div>
                                        <label className="text-xs font-semibold text-red-500 block mb-1">Damaged</label>
                                        <input type="number" min={0} max={item.currentUnits} placeholder="0" value={item.damaged}
                                          onChange={(e) => updatePersonalStockItem(index, 'damaged', e.target.value)}
                                          className="w-full px-2.5 py-2 rounded-xl text-xs text-center font-bold focus:outline-none border-0 text-red-500"
                                          style={nm.inset} />
                                      </div>
                                    </div>
                                    {isExceeded && (
                                      <p className="text-xs font-semibold text-red-500">Total ({used + damaged}) exceeds available ({item.currentUnits})</p>
                                    )}
                                    <button onClick={() => toggleStockItem(index)} disabled={isExceeded}
                                      className="w-full py-2 rounded-xl text-xs font-bold text-white border-0 disabled:opacity-50 transition-all"
                                      style={{ background: 'linear-gradient(145deg, #06b6d4, #0891b2)', borderRadius: '14px', boxShadow: '3px 3px 8px #c5d8e8, -2px -2px 6px #ffffff' }}
                                    >Done</button>
                                  </>
                                )
                              })()}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 rounded-xl" style={nm.inset}>
                    <svg className="w-7 h-7 mx-auto mb-1 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                    <p className="text-xs text-gray-400">No items added</p>
                  </div>
                )}
              </div>
            )}

            {/* Total Amount & Payment Type */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl p-4" style={nm.base}>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Total Amount (₹)
                </label>
                <input
                  type="number"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0"
                  disabled={invoiceSaved}
                  className="w-full px-3 py-2.5 rounded-xl text-base font-bold focus:outline-none border-0 text-gray-800 disabled:opacity-50"
                  style={nm.inset}
                />
              </div>
              <div className="rounded-2xl p-4" style={nm.base}>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                  Payment Type
                </label>
                <select
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  disabled={invoiceSaved}
                  className="w-full px-3 py-2.5 rounded-xl text-sm font-bold focus:outline-none border-0 text-gray-800 disabled:opacity-50"
                  style={nm.inset}
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
            <div className="rounded-2xl p-4" style={nm.base}>
              <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-3">
                <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 10V5a2 2 0 012-2z" /></svg>
                Discount
              </label>
              <div className="flex gap-2 mb-3">
                {['percentage', 'amount'].map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setDiscountType(type)}
                    disabled={invoiceSaved}
                    className="flex-1 py-2 px-3 rounded-xl text-sm font-bold border-0 disabled:opacity-50 transition-all"
                    style={discountType === type
                      ? { background: 'linear-gradient(145deg, #06b6d4, #0891b2)', color: '#fff', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.2), inset -2px -2px 5px rgba(255,255,255,0.1)' }
                      : nm.raised
                    }
                  >
                    <span className="text-inherit">{type === 'percentage' ? '% Percentage' : '₹ Amount'}</span>
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Enter %' : 'Enter amount'}
                  disabled={invoiceSaved}
                  className="w-full px-3 py-2.5 rounded-xl text-base font-bold focus:outline-none border-0 text-gray-800 disabled:opacity-50"
                  style={nm.inset}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                  {discountType === 'percentage' ? '%' : '₹'}
                </span>
              </div>
              {discountAmount > 0 && (
                <p className="text-xs font-semibold text-emerald-600 mt-2 ml-1">Discount: -₹{discountAmount.toFixed(2)}</p>
              )}
            </div>

            {/* Summary */}
            <div className="rounded-2xl p-4" style={nm.inset}>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-500">Total Amount</p>
                  <p className="text-sm font-bold text-gray-800">₹{(parseFloat(totalAmount) || 0).toFixed(2)}</p>
                </div>
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-emerald-500">Discount ({discountType === 'percentage' ? `${discountValue}%` : `₹${discountValue}`})</p>
                    <p className="text-sm font-bold text-emerald-500">-₹{discountAmount.toFixed(2)}</p>
                  </div>
                )}
                <div className="pt-2" style={{ borderTop: '1px solid #c5d8e8' }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-black text-cyan-600">Grand Total</p>
                    <p className="text-2xl font-black text-cyan-600">₹{grandTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Received */}
            {!invoiceSaved && (
              <div className="rounded-2xl p-4" style={nm.base}>
                <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 mb-2">
                  <svg className="w-3.5 h-3.5 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Amount Received from Customer (₹)
                </label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full px-3 py-2.5 rounded-xl text-base font-bold focus:outline-none border-0 text-gray-800"
                  style={nm.inset}
                />
                {amountReceived !== '' && parseFloat(amountReceived) > grandTotal && (
                  <p className="text-xs text-red-500 mt-2 font-semibold flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    Cannot exceed Grand Total (₹{grandTotal.toFixed(2)})
                  </p>
                )}
                {amountReceived !== '' && parseFloat(amountReceived) >= 0 && parseFloat(amountReceived) <= grandTotal && (
                  <p className={`text-xs font-semibold mt-2 flex items-center gap-1 ${
                    parseFloat(amountReceived) >= grandTotal ? 'text-emerald-600' : 'text-amber-500'
                  }`}>
                    {parseFloat(amountReceived) >= grandTotal ? (
                      <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Full payment — marked as Paid</>
                    ) : (
                      <><svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>Partial — Pending: ₹{(grandTotal - parseFloat(amountReceived)).toFixed(2)}</>
                    )}
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col md:flex-row gap-3 pt-2 pb-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full md:flex-1 rounded-2xl py-3.5 text-sm font-bold text-gray-600 border-0 flex items-center justify-center gap-2 transition-all"
                style={{ ...nm.raised, borderRadius: '18px' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                Close
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const billNo = savedInvoiceData?.billNo || `FAC-${Date.now()}`
                  const allInvoiceProducts = [
                    ...products,
                    ...personalStockUsage.filter(i => i.productId && (Number(i.used) || 0) > 0).map(i => ({ name: i.productName, qty: Number(i.used) || 0 }))
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
                    amountReceived: invoiceSaved && savedInvoiceData?.amountReceived !== undefined ? savedInvoiceData.amountReceived : parseFloat(amountReceived) || 0,
                    products: allInvoiceProducts,
                    paymentMode: paymentType,
                  })
                  toast.success('Invoice downloaded!')
                }}
                disabled={amountReceived === '' || amountReceived === null || parseFloat(amountReceived) > grandTotal}
                className="w-full md:flex-1 rounded-xl py-3 text-sm font-bold text-white border-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                style={{ background: 'linear-gradient(145deg, #8b5cf6, #7c3aed)', borderRadius: '18px', boxShadow: '4px 4px 12px #c5d8e8, -3px -3px 8px #ffffff, 0 4px 16px rgba(124,58,237,0.3)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Download Invoice
              </motion.button>

              {!invoiceSaved && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowSaveConfirmation(true)}
                  disabled={saving || sharing || amountReceived === '' || amountReceived === null || parseFloat(amountReceived) > grandTotal}
                  className="w-full md:flex-1 rounded-xl py-3 text-sm font-bold text-white border-0 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(145deg, #06b6d4, #0891b2)', borderRadius: '18px', boxShadow: '4px 4px 12px #c5d8e8, -3px -3px 8px #ffffff, 0 4px 16px rgba(6,182,212,0.3)' }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>
                  Save Invoice
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
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => !saving && setShowSaveConfirmation(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-md rounded-2xl p-6"
          style={{ background: '#e8f4fb', borderRadius: '1.5rem' }}
        >
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center" style={{ background: '#e8f4fb', boxShadow: 'inset 4px 4px 10px #c5d8e8, inset -3px -3px 8px #ffffff' }}>
              <svg className="w-7 h-7 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-800 mb-1">Save Invoice?</h3>
              <p className="text-sm text-gray-500">Once saved, you cannot edit this invoice. Make sure all details are correct.</p>
            </div>
            <div className="flex gap-3 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowSaveConfirmation(false)}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-600 border-0 disabled:opacity-50 transition-all"
                style={{ background: '#e8f4fb', borderRadius: '18px', boxShadow: '4px 4px 10px #c5d8e8, -3px -3px 8px #ffffff' }}
              >
                Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGenerateInvoice}
                disabled={saving}
                className="flex-1 py-3 rounded-xl text-sm font-bold text-white border-0 disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(145deg, #06b6d4, #0891b2)', borderRadius: '18px', boxShadow: saving ? 'inset 4px 4px 10px rgba(0,0,0,0.2)' : '4px 4px 12px #c5d8e8, -3px -3px 8px #ffffff, 0 4px 16px rgba(6,182,212,0.3)' }}
              >
                {saving ? (
                  <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" /></svg>Saving...</>
                ) : (
                  <><svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>Confirm Save</>
                )}
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
    </>
  )
}
