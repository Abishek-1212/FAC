import { useState, useEffect } from 'react'
import { collection, addDoc, serverTimestamp, updateDoc, doc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from './Modal'
import toast from 'react-hot-toast'

export default function PaymentStatusModal({ open, onClose, report, isDark, onPaymentUpdated }) {
  const [paymentStatus, setPaymentStatus] = useState('fully_paid')
  const [partialAmount, setPartialAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [invoiceData, setInvoiceData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open || !report?.jobId) return
    
    const fetchInvoice = async () => {
      setLoading(true)
      try {
        const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', report.jobId)))
        if (invoicesSnap.docs.length > 0) {
          setInvoiceData(invoicesSnap.docs[0].data())
        }
      } catch (err) {
        console.error('Error fetching invoice:', err)
      } finally {
        setLoading(false)
      }
    }
    
    fetchInvoice()
  }, [open, report?.jobId])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      // Get invoice data
      const invoicesSnap = await getDocs(query(collection(db, 'invoices'), where('jobId', '==', report.jobId)))
      
      if (invoicesSnap.docs.length === 0) {
        toast.error('Please generate invoice first!')
        setSubmitting(false)
        return
      }

      const invoiceDoc = invoicesSnap.docs[0]
      const invoiceData = invoiceDoc.data()
      const totalAmount = invoiceData?.billAmount || 0

      let amountReceived = totalAmount
      let paymentPending = 0

      if (paymentStatus === 'partial') {
        const partial = parseFloat(partialAmount) || 0
        if (partial <= 0 || partial >= totalAmount) {
          toast.error('Please enter valid partial amount!')
          setSubmitting(false)
          return
        }
        amountReceived = partial
        paymentPending = totalAmount - partial
      }

      // Update invoice with payment status
      await updateDoc(doc(db, 'invoices', invoiceDoc.id), {
        amountReceived,
        paymentPending,
        paymentStatus: paymentStatus === 'fully_paid' ? 'Fully Paid' : 'Partial Payment',
        updatedToAdmin: true,
        updatedAt: serverTimestamp()
      })

      // Create admin notification
      await addDoc(collection(db, 'admin_notifications'), {
        type: 'payment_update',
        jobId: report.jobId,
        invoiceId: invoiceDoc.id,
        invoiceNumber: invoiceData.billNo,
        customerName: report.customerName,
        technicianName: report.technicianName,
        totalAmount,
        amountReceived,
        paymentPending,
        paymentStatus: paymentStatus === 'fully_paid' ? 'Fully Paid' : 'Partial Payment',
        message: paymentStatus === 'fully_paid' 
          ? `Payment fully received for invoice ${invoiceData.billNo}`
          : `Partial payment of ₹${amountReceived} received. Pending: ₹${paymentPending}`,
        read: false,
        createdAt: serverTimestamp()
      })

      toast.success('✅ Payment status updated to admin!')
      setSubmitting(false)
      
      // Notify parent component
      if (onPaymentUpdated) {
        onPaymentUpdated()
      }
      
      onClose()
    } catch (err) {
      console.error('Error updating payment status:', err)
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Update Payment Status" size="md">
      <div className={`space-y-6 ${isDark ? 'bg-gradient-to-b from-gray-900 to-gray-800' : 'bg-gradient-to-b from-gray-50 to-white'}`}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
        {/* Customer Info */}
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{report.customerName}</p>
          <p className={`text-xs mt-1 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📞 {report.customerPhone}</p>
        </div>

        {/* Grand Total Display */}
        {invoiceData && (
          <div className={`rounded-xl p-6 border-2 ${isDark ? 'bg-gradient-to-br from-cyan-900/30 to-blue-900/30 border-cyan-600/50' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-300'}`}>
            <p className={`text-xs font-semibold mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>Invoice Grand Total</p>
            <p className={`text-3xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{(invoiceData.billAmount || 0).toFixed(2)}</p>
          </div>
        )}

        {/* Payment Status Selection */}
        <div className={`rounded-xl p-6 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <label className={`text-sm font-bold block mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Status</label>
          
          <div className="space-y-3">
            {/* Fully Paid Option */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setPaymentStatus('fully_paid')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                paymentStatus === 'fully_paid'
                  ? isDark
                    ? 'border-green-500 bg-green-500/20'
                    : 'border-green-500 bg-green-50'
                  : isDark
                  ? 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentStatus === 'fully_paid'
                    ? 'border-green-500 bg-green-500'
                    : isDark ? 'border-gray-600' : 'border-gray-300'
                }`}>
                  {paymentStatus === 'fully_paid' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>✅ Fully Paid</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Customer paid the full amount</p>
                </div>
              </div>
            </motion.button>

            {/* Partial Payment Option */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setPaymentStatus('partial')}
              className={`w-full p-4 rounded-xl border-2 transition-all text-left ${
                paymentStatus === 'partial'
                  ? isDark
                    ? 'border-amber-500 bg-amber-500/20'
                    : 'border-amber-500 bg-amber-50'
                  : isDark
                  ? 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  paymentStatus === 'partial'
                    ? 'border-amber-500 bg-amber-500'
                    : isDark ? 'border-gray-600' : 'border-gray-300'
                }`}>
                  {paymentStatus === 'partial' && (
                    <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>⚠️ Partial Payment</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Customer paid partial amount</p>
                </div>
              </div>
            </motion.button>
          </div>

          {/* Partial Amount Input */}
          {paymentStatus === 'partial' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <label className={`text-xs font-bold block mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Amount Received (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={partialAmount}
                onChange={(e) => setPartialAmount(e.target.value)}
                onWheel={(e) => e.target.blur()}
                placeholder="Enter amount received"
                className={`w-full px-4 py-3 rounded-xl text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 transition ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                } border`}
              />
            </motion.div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`flex-1 rounded-xl py-3.5 text-sm font-bold transition ${
              isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            ✕ Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={submitting || (paymentStatus === 'partial' && !partialAmount)}
            className={`flex-1 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-50 transition ${
              isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
            }`}
          >
            {submitting ? '⏳ Updating...' : '✅ Update to Admin'}
          </motion.button>
        </div>
        </>
        )}
      </div>
    </Modal>
  )
}
