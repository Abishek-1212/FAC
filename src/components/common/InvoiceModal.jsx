import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from './Modal'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

export default function InvoiceModal({ open, onClose, job, isDark }) {
  const [completionReport, setCompletionReport] = useState(null)
  const [products, setProducts] = useState([])
  const [serviceCharge, setServiceCharge] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !job?.id) return
    setLoading(true)
    
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
                price: productsMap[item.productName] || 0,
              })) || []
              
              setProducts(itemsWithPrices)
            } catch (err) {
              console.warn('Could not fetch product prices:', err.message)
              const itemsWithoutPrices = report.itemsSummary?.map(item => ({
                name: item.productName,
                qty: item.used,
                price: 0,
              })) || []
              setProducts(itemsWithoutPrices)
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

  const subtotal = products.reduce((sum, p) => sum + (p.qty * p.price), 0)
  const total = subtotal + parseFloat(serviceCharge || 0)

  const handleGenerateInvoice = async () => {
    setSaving(true)
    try {
      const invoiceNumber = `FAC-${Date.now()}`
      const invoiceData = {
        invoiceNumber,
        customerName: job.customerName,
        customerPhone: job.customerPhone,
        customerAddress: job.customerAddress,
        technicianName: job.technicianName,
        serviceType: job.serviceType,
        problemDescription: job.problemDescription,
        serviceCharge: parseFloat(serviceCharge),
        products,
        notes,
      }

      const invoiceRef = await addDoc(collection(db, 'invoices'), {
        ...invoiceData,
        jobId: job.id,
        totalAmount: total,
        createdAt: serverTimestamp(),
      })
      
      generateInvoice(invoiceData)
      
      toast.success('✅ Invoice generated!')
      setSaving(false)
      return invoiceRef.id
    } catch (err) {
      toast.error(err.message)
      setSaving(false)
      return null
    }
  }

  const handleShareInvoice = async () => {
    setSharing(true)
    try {
      const invoiceId = await handleGenerateInvoice()
      if (!invoiceId) {
        setSharing(false)
        return
      }

      const phone = job.customerPhone.replace(/\D/g, '')
      const message = `Hi ${job.customerName}, your invoice for ${job.serviceType} service is ready. Invoice #FAC-${Date.now()}`
      const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      
      window.open(whatsappUrl, '_blank')
      toast.success('✅ Invoice shared! Redirecting...')
      
      setTimeout(() => {
        onClose()
        window.location.href = '/technician'
      }, 1500)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSharing(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="" size="lg">
      <div className={`space-y-4 md:space-y-6 max-h-[85vh] overflow-y-auto scrollbar-hide ${
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
                        <div className="flex justify-between items-start">
                          <p className={`font-semibold text-sm flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                          <p className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>₹{(product.qty * product.price).toFixed(2)}</p>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Qty: <span className={`font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>{product.qty}</span></span>
                          <span className={isDark ? 'text-gray-400' : 'text-gray-500'}>Price: <span className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{product.price.toFixed(2)}</span></span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block">
                    <div className={`grid grid-cols-12 gap-3 pb-3 border-b ${
                      isDark ? 'border-gray-700' : 'border-gray-200'
                    }`}>
                      <div className="col-span-5">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Product</p>
                      </div>
                      <div className="col-span-2 text-center">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Qty</p>
                      </div>
                      <div className="col-span-2 text-right">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Price</p>
                      </div>
                      <div className="col-span-3 text-right">
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Amount</p>
                      </div>
                    </div>

                    {products.map((product, idx) => (
                      <div key={idx} className={`grid grid-cols-12 gap-3 py-3 px-3 rounded-lg ${
                        isDark ? 'bg-gray-700/50' : 'bg-gray-50'
                      }`}>
                        <div className="col-span-5">
                          <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{product.name}</p>
                        </div>
                        <div className="col-span-2 text-center">
                          <p className={`font-bold text-sm ${isDark ? 'text-cyan-300' : 'text-cyan-600'}`}>{product.qty}</p>
                        </div>
                        <div className="col-span-2 text-right">
                          <p className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{product.price.toFixed(2)}</p>
                        </div>
                        <div className="col-span-3 text-right">
                          <p className={`font-bold text-sm ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>₹{(product.qty * product.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>No products tracked for this job</p>
              )}
            </div>

            {/* Service Charge Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <label className={`text-sm font-bold block mb-2 md:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>⚙️ Service Charge (₹)</label>
              <input
                type="number"
                value={serviceCharge}
                onChange={(e) => setServiceCharge(e.target.value)}
                placeholder="Enter service charge"
                className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-base md:text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                } border`}
              />
            </div>

            {/* Notes Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border ${
              isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
            }`}>
              <label className={`text-sm font-bold block mb-2 md:mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>📝 Notes (Optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes or terms..."
                rows={3}
                className={`w-full px-3 md:px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition resize-none ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                } border`}
              />
            </div>

            {/* Summary Section */}
            <div className={`rounded-xl md:rounded-2xl p-4 md:p-6 border-2 ${
              isDark ? 'bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-600/50' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-300'
            }`}>
              <div className="space-y-2 md:space-y-3">
                <div className="flex items-center justify-between">
                  <p className={`text-xs md:text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Subtotal</p>
                  <p className={`text-sm md:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{subtotal.toFixed(2)}</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className={`text-xs md:text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>Service Charge</p>
                  <p className={`text-sm md:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>₹{parseFloat(serviceCharge || 0).toFixed(2)}</p>
                </div>
                <div className={`border-t-2 pt-2 md:pt-3 ${isDark ? 'border-cyan-600/50' : 'border-cyan-300'}`}>
                  <div className="flex items-center justify-between">
                    <p className={`text-sm md:text-lg font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>Total</p>
                    <p className={`text-xl md:text-3xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{total.toFixed(2)}</p>
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
                ✕ Cancel
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleGenerateInvoice}
                disabled={saving || sharing}
                className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white disabled:opacity-60 transition ${
                  isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                }`}
              >
                {saving ? '⏳ Generating...' : '📥 Download'}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleShareInvoice}
                disabled={saving || sharing}
                className={`w-full md:flex-1 rounded-lg md:rounded-xl py-2.5 md:py-3.5 text-xs md:text-sm font-bold text-white disabled:opacity-60 transition ${
                  isDark ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' : 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600'
                }`}
              >
                {sharing ? '⏳ Sharing...' : '📤 Share'}
              </motion.button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
