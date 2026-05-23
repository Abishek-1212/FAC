import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from './Modal'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

export default function InvoiceModal({ open, onClose, job, isDark, onInvoiceSaved }) {
  const [completionReport, setCompletionReport] = useState(null)
  const [products, setProducts] = useState([])
  const [totalAmount, setTotalAmount] = useState(0)
  const [discountType, setDiscountType] = useState('percentage') // 'percentage' or 'amount'
  const [discountValue, setDiscountValue] = useState(0)
  const [paymentType, setPaymentType] = useState('Cash')
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [invoiceSaved, setInvoiceSaved] = useState(false)
  const [savedInvoiceData, setSavedInvoiceData] = useState(null)

  useEffect(() => {
    if (!open || !job?.id) return
    setLoading(true)
    
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
    return unsubscribe
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

  const handleGenerateInvoice = async () => {
    setSaving(true)
    try {
      const billNo = `FAC-${Date.now()}`
      const billAmount = grandTotal
      const invoiceData = {
        billNo,
        jobId: job.id || '',
        customerName: job.customerName || 'N/A',
        customerPhone: job.customerPhone || 'N/A',
        customerAddress: job.customerAddress || 'N/A',
        technicianId: job.technicianId || '',
        technicianName: job.technicianName || 'N/A',
        serviceType: job.serviceType || 'N/A',
        components: products.map(p => ({ name: p.name || 'N/A', quantity: p.qty || 0 })),
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
      
      setInvoiceSaved(true)
      setSavedInvoiceData(invoiceData)
      
      // Notify parent component that invoice was saved
      if (onInvoiceSaved) {
        onInvoiceSaved()
      }
      
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
        products,
      })
      
      toast.success('✅ Invoice saved successfully!')
      setSaving(false)
      return billNo
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
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
    <Modal open={open} onClose={onClose} title="" size="lg">
      <div className={`space-y-4 md:space-y-6 ${
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

            {/* Products Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <h3 className={`text-base md:text-lg font-bold mb-3 md:mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>📦 Products Used</h3>
              
              {products.length > 0 ? (
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
              ) : (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No products tracked for this job</p>
              )}
            </div>

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
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${
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
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold transition ${
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
              {!invoiceSaved ? (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleGenerateInvoice}
                  disabled={saving || sharing}
                  className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white disabled:opacity-60 transition ${
                    isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                  }`}
                >
                  {saving ? '⏳ Saving...' : '💾 Save Invoice'}
                </motion.button>
              ) : (
                <>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      generateInvoice({
                        invoiceNumber: savedInvoiceData.billNo,
                        customerName: job.customerName || 'N/A',
                        customerPhone: job.customerPhone || 'N/A',
                        customerAddress: job.customerAddress || 'N/A',
                        technicianName: job.technicianName || 'N/A',
                        serviceType: job.serviceType || 'N/A',
                        problemDescription: job.problemDescription || 'N/A',
                        totalAmount: savedInvoiceData.totalAmount,
                        discountType: savedInvoiceData.discountType,
                        discountValue: savedInvoiceData.discountValue,
                        discountAmount: savedInvoiceData.discountAmount,
                        grandTotal: savedInvoiceData.billAmount,
                        products,
                      })
                      toast.success('📥 Invoice downloaded!')
                    }}
                    className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white transition ${
                      isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                    }`}
                  >
                    📥 Download
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const phone = job.customerPhone.replace(/\D/g, '')
                      const message = `Hi ${job.customerName}, your invoice for ${job.serviceType} service is ready. Invoice #${savedInvoiceData.billNo}`
                      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                      window.open(whatsappUrl, '_blank')
                      toast.success('✅ Invoice shared!')
                    }}
                    className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white transition ${
                      isDark ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                    }`}
                  >
                    📤 Share
                  </motion.button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
