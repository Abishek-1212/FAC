import { useState, useEffect } from 'react'
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion } from 'framer-motion'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

export default function AdminPaymentUpdateModal({ open, onClose, invoice, isDark, onPaymentUpdated }) {
  const [paymentAction, setPaymentAction] = useState('add_payment')
  const [additionalAmount, setAdditionalAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (open) {
      setPaymentAction('add_payment')
      setAdditionalAmount('')
    }
  }, [open])

  const handleSubmit = async () => {
    if (!invoice) return

    setSubmitting(true)
    try {
      const totalAmount = invoice.billAmount || 0
      const currentReceived = invoice.amountReceived || 0
      const currentPending = invoice.paymentPending || 0

      let newAmountReceived = currentReceived
      let newPaymentPending = currentPending
      let newPaymentStatus = invoice.paymentStatus || 'Pending'

      if (paymentAction === 'mark_paid') {
        // Mark as fully paid
        newAmountReceived = totalAmount
        newPaymentPending = 0
        newPaymentStatus = 'Fully Paid'
      } else if (paymentAction === 'add_payment') {
        // Add additional payment
        const additional = parseFloat(additionalAmount) || 0
        if (additional <= 0) {
          toast.error('Please enter a valid amount!')
          setSubmitting(false)
          return
        }
        if (additional > currentPending) {
          toast.error('Amount cannot exceed pending amount!')
          setSubmitting(false)
          return
        }
        newAmountReceived = currentReceived + additional
        newPaymentPending = currentPending - additional
        newPaymentStatus = newPaymentPending === 0 ? 'Fully Paid' : 'Partial Payment'
      }

      // Create payment history entry
      const paymentHistoryEntry = {
        date: new Date(),
        action: paymentAction === 'mark_paid' ? 'Marked as Fully Paid' : `Added Payment: ₹${additionalAmount}`,
        amountReceived: newAmountReceived,
        paymentPending: newPaymentPending,
        note: 'Updated by admin',
        updatedBy: 'admin'
      }

      // Update invoice
      await updateDoc(doc(db, 'invoices', invoice.id), {
        amountReceived: newAmountReceived,
        paymentPending: newPaymentPending,
        paymentStatus: newPaymentStatus,
        paymentHistory: arrayUnion(paymentHistoryEntry),
        lastUpdatedByAdmin: serverTimestamp()
      })

      toast.success('✅ Payment updated successfully!')
      setSubmitting(false)
      
      if (onPaymentUpdated) {
        onPaymentUpdated()
      }
      
      onClose()
    } catch (err) {
      console.error('Error updating payment:', err)
      toast.error(err.message)
      setSubmitting(false)
    }
  }

  if (!invoice) return null

  const totalAmount = invoice.billAmount || 0
  const currentReceived = invoice.amountReceived || 0
  const currentPending = invoice.paymentPending || 0

  return (
    <Modal open={open} onClose={onClose} title="Update Payment Status" size="md">
      <div className="space-y-4">
        {/* Invoice Info */}
        <div className={`rounded-xl p-3 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{invoice.customerName}</p>
              <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Invoice #{invoice.billNo}</p>
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${currentPending > 0 ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
              {currentPending > 0 ? 'PARTIAL' : 'PAID'}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-lg p-2 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-50'}`}>
              <p className={`text-xs font-bold mb-1 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Total</p>
              <p className={`text-base font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{totalAmount.toLocaleString('en-IN')}</p>
            </div>
            <div className={`rounded-lg p-2 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
              <p className={`text-xs font-bold mb-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>Received</p>
              <p className={`text-base font-black ${isDark ? 'text-green-300' : 'text-green-700'}`}>₹{currentReceived.toLocaleString('en-IN')}</p>
            </div>
            <div className={`rounded-lg p-2 ${currentPending > 0 ? isDark ? 'bg-red-500/10' : 'bg-red-50' : isDark ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <p className={`text-xs font-bold mb-1 ${currentPending > 0 ? isDark ? 'text-red-400' : 'text-red-600' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>Pending</p>
              <p className={`text-base font-black ${currentPending > 0 ? isDark ? 'text-red-300' : 'text-red-700' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>₹{currentPending.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        {/* Payment Action Selection */}
        <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <label className={`text-sm font-bold block mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment Action</label>
          
          <div className="space-y-2">
            {/* Add Payment Option */}
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={() => setPaymentAction('add_payment')}
              className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                paymentAction === 'add_payment'
                  ? isDark
                    ? 'border-blue-500 bg-blue-500/20'
                    : 'border-blue-500 bg-blue-50'
                  : isDark
                  ? 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                  : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  paymentAction === 'add_payment'
                    ? 'border-blue-500 bg-blue-500'
                    : isDark ? 'border-gray-600' : 'border-gray-300'
                }`}>
                  {paymentAction === 'add_payment' && (
                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Add Payment</p>
                  <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Add additional payment received</p>
                </div>
              </div>
            </motion.button>

            {/* Mark as Fully Paid Option */}
            {currentPending > 0 && (
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setPaymentAction('mark_paid')}
                className={`w-full p-3 rounded-xl border-2 transition-all text-left ${
                  paymentAction === 'mark_paid'
                    ? isDark
                      ? 'border-green-500 bg-green-500/20'
                      : 'border-green-500 bg-green-50'
                    : isDark
                    ? 'border-gray-700 bg-gray-700/50 hover:border-gray-600'
                    : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    paymentAction === 'mark_paid'
                      ? 'border-green-500 bg-green-500'
                      : isDark ? 'border-gray-600' : 'border-gray-300'
                  }`}>
                    {paymentAction === 'mark_paid' && (
                      <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Mark as Fully Paid</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Mark entire amount as received</p>
                  </div>
                </div>
              </motion.button>
            )}
          </div>

          {/* Additional Amount Input */}
          {paymentAction === 'add_payment' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <label className={`text-xs font-bold block mb-2 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Amount Received (₹)
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={additionalAmount}
                onChange={(e) => setAdditionalAmount(e.target.value)}
                onWheel={(e) => e.target.blur()}
                placeholder={`Max: ₹${currentPending.toLocaleString('en-IN')}`}
                className={`w-full px-4 py-2.5 rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition ${
                  isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
                } border`}
              />
            </motion.div>
          )}
        </div>

        {/* Payment History */}
        {invoice.paymentHistory && invoice.paymentHistory.length > 0 && (
          <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
            <p className={`text-sm font-bold mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Payment History</p>
            <div className="space-y-2">
              {invoice.paymentHistory.slice(-3).reverse().map((entry, index) => (
                <div key={index} className={`p-2.5 rounded-lg ${isDark ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className={`text-xs font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{entry.action}</p>
                      {entry.note && (
                        <p className={`text-xs mt-0.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>{entry.note}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                      {entry.date?.toDate ? entry.date.toDate().toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : new Date(entry.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
              isDark ? 'bg-gray-700 text-white hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Cancel
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleSubmit}
            disabled={submitting || (paymentAction === 'add_payment' && !additionalAmount)}
            className={`flex-1 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50 transition ${
              isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
            }`}
          >
            {submitting ? 'Updating...' : 'Update Payment'}
          </motion.button>
        </div>
      </div>
    </Modal>
  )
}
