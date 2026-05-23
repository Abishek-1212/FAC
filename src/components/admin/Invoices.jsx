import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import InvoicePDF from '../common/InvoicePDF'
import Modal from '../common/Modal'
import AdminPaymentUpdateModal from './AdminPaymentUpdateModal'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { motion } from 'framer-motion'

const formatDate = (ts) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export default function Invoices() {
  const { isDark } = useTheme()
  const [invoices, setInvoices] = useState([])
  const [viewInvoice, setViewInvoice] = useState(null)
  const [filter, setFilter] = useState('all')
  const [editPaymentInvoice, setEditPaymentInvoice] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'invoices'), snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0))
      setInvoices(data)
    })
  }, [])

  const openInvoice = async (inv) => {
    setViewInvoice(inv)
    // Mark as viewed by admin
    if (!inv.adminViewed) {
      await updateDoc(doc(db, 'invoices', inv.id), { adminViewed: true, adminViewedAt: new Date() })
    }
  }

  const generatePDF = async (inv) => {
    if (!invoiceRef.current) return null
    try {
      const canvas = await html2canvas(invoiceRef.current, { scale: 2, backgroundColor: '#ffffff', windowWidth: 794, windowHeight: 1123 })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')
      pdf.addImage(imgData, 'PNG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
      return { pdf, fileName: `FAC_Invoice_${inv.billNo}_${inv.customerName.replace(/\s+/g, '_')}.pdf` }
    } catch {
      toast.error('Failed to generate PDF')
      return null
    }
  }

  const downloadPDF = async () => {
    const result = await generatePDF(viewInvoice)
    if (!result) return
    result.pdf.save(result.fileName)
    toast.success('📥 PDF downloaded!')
  }

  const shareWhatsApp = async () => {
    const result = await generatePDF(viewInvoice)
    if (!result) return
    result.pdf.save(result.fileName)
    let phone = (viewInvoice.customerPhone || '').replace(/[\s-]/g, '')
    if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone
    const msg = `*FRIENDS AQUA CARE - Invoice*\n\nBill No: ${viewInvoice.billNo}\nCustomer: ${viewInvoice.customerName}\nService: ${viewInvoice.serviceType}\nDate: ${viewInvoice.invoiceDate}\n\nBill Amount: ₹${viewInvoice.billAmount.toLocaleString('en-IN')}\nAmount Received: ₹${viewInvoice.amountReceived.toLocaleString('en-IN')}\n${viewInvoice.paymentPending > 0 ? `Pending: ₹${viewInvoice.paymentPending.toLocaleString('en-IN')}\n` : ''}\nPDF downloaded. Please attach it in WhatsApp.\n\nThank you for choosing Friends Aqua Care!`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank')
    toast.success('📱 PDF downloaded! Attach it in WhatsApp.')
  }

  const filteredInvoices = invoices.filter(inv => {
    if (filter === 'pending') return (inv.paymentPending || 0) > 0
    if (filter === 'paid') return (inv.paymentPending || 0) === 0
    return true
  })

  // Group invoices by date
  const groupInvoicesByDate = (invoicesList) => {
    const grouped = {}
    invoicesList.forEach(inv => {
      const dateKey = inv.invoiceDate || formatDate(inv.generatedDate)
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(inv)
    })
    return grouped
  }

  const groupedInvoices = groupInvoicesByDate(filteredInvoices)

  const totalRevenue = invoices.reduce((s, i) => s + (i.billAmount || 0), 0)
  const totalReceived = invoices.reduce((s, i) => s + (i.amountReceived || 0), 0)
  const totalPending = invoices.reduce((s, i) => s + (i.paymentPending || 0), 0)
  const unread = invoices.filter(i => i.submittedByTechnician && !i.adminViewed).length

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className={`p-2.5 rounded-lg transition ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-white text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div className="flex-1">
          <h2 className={`text-2xl font-black ${t}`}>Invoices</h2>
          <p className={`text-sm mt-0.5 ${s}`}>Manage all invoices</p>
        </div>
        {unread > 0 && (
          <span className="bg-red-500 text-white text-xs font-black px-3 py-1.5 rounded-lg shadow-lg">
            {unread} new
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { 
            label: 'Total Billed', 
            value: `₹${totalRevenue.toLocaleString('en-IN')}`, 
            bgColor: isDark ? 'bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border-cyan-500/20' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200',
            valueColor: isDark ? 'text-cyan-300' : 'text-cyan-700'
          },
          { 
            label: 'Received', 
            value: `₹${totalReceived.toLocaleString('en-IN')}`, 
            bgColor: isDark ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20' : 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200',
            valueColor: isDark ? 'text-green-300' : 'text-green-700'
          },
          { 
            label: 'Pending', 
            value: `₹${totalPending.toLocaleString('en-IN')}`, 
            bgColor: isDark ? 'bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20' : 'bg-gradient-to-br from-red-50 to-orange-50 border-red-200',
            valueColor: isDark ? 'text-red-300' : 'text-red-700'
          },
        ].map(card => (
          <div key={card.label} className={`rounded-xl p-3 border ${card.bgColor}`}>
            <p className={`text-xs font-bold mb-2 ${s}`}>{card.label}</p>
            <p className={`text-lg font-black ${card.valueColor}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {[
          { key: 'all', label: 'All' },
          { key: 'pending', label: 'Pending Payment' },
          { key: 'paid', label: 'Fully Paid' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap ${filter === tab.key ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {filteredInvoices.length === 0 ? (
        <div className={`${cardBase} p-12 text-center`}>
          <p className="text-4xl mb-3">📄</p>
          <p className={`text-sm ${s}`}>{filter === 'all' ? 'No invoices yet' : `No ${filter} invoices`}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedInvoices).map(([date, dateInvoices], dateIndex) => (
            <div key={date} className="space-y-3">
              {/* Date Header - Sticky */}
              <div className={`sticky top-0 z-10 backdrop-blur-sm py-3 px-4 rounded-xl border ${isDark ? 'bg-dark-card/90 border-white/10' : 'bg-white/90 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-sm font-black ${t}`}>
                    📅 {date}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                    {dateInvoices.length} invoice{dateInvoices.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Invoices for this date */}
              <div className="grid gap-4">
                {dateInvoices.map((inv, i) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openInvoice(inv)}
              className={`${cardBase} overflow-hidden cursor-pointer transition-all hover:shadow-xl ${!inv.adminViewed && inv.submittedByTechnician ? isDark ? 'border-cyan-500 shadow-lg shadow-cyan-500/20' : 'border-cyan-400 shadow-lg shadow-cyan-200' : isDark ? 'hover:border-cyan-500/30' : 'hover:border-cyan-300'}`}
            >
              {/* Top Bar with Invoice Number and Status */}
              <div className={`px-5 py-3 flex items-center justify-between border-b ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-700 border-white/10' : 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-black ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{inv.billNo}</span>
                  {!inv.adminViewed && inv.submittedByTechnician && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold animate-pulse shadow-lg">
                      ✨ NEW
                    </span>
                  )}
                </div>
                <span className={`text-xs font-semibold ${s}`}>📅 {inv.invoiceDate}</span>
              </div>

              {/* Main Content */}
              <div className="p-5 space-y-4">
                {/* Customer & Technician Info */}
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className={`text-xl font-black mb-2 ${t}`}>{inv.customerName}</h3>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>📞 Phone:</span>
                        <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{inv.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>👷 Technician:</span>
                        <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{inv.technicianName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>🔧 Service:</span>
                        <span className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{inv.serviceType || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                  <div className={`px-4 py-2 rounded-xl ${(inv.paymentPending || 0) > 0 ? isDark ? 'bg-amber-500/20 border border-amber-500/50' : 'bg-amber-100 border border-amber-300' : isDark ? 'bg-green-500/20 border border-green-500/50' : 'bg-green-100 border border-green-300'}`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${(inv.paymentPending || 0) > 0 ? isDark ? 'text-amber-300' : 'text-amber-700' : isDark ? 'text-green-300' : 'text-green-700'}`}>
                      {(inv.paymentPending || 0) > 0 ? 'PARTIAL' : 'PAID'}
                    </p>
                  </div>
                </div>

                {/* Payment Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Total Amount */}
                  <div className={`rounded-xl p-3 md:p-4 ${isDark ? 'bg-gradient-to-br from-cyan-900/40 to-blue-900/40 border border-cyan-500/40' : 'bg-gradient-to-br from-cyan-50 to-blue-50 border border-cyan-300'}`}>
                    <div className="flex items-center justify-between md:flex-col md:items-start gap-2">
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                        </svg>
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Total</p>
                      </div>
                      <p className={`text-xl md:text-2xl font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>₹{(inv.billAmount || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Amount Received */}
                  <div className={`rounded-xl p-3 md:p-4 ${isDark ? 'bg-gradient-to-br from-green-900/40 to-emerald-900/40 border border-green-500/40' : 'bg-gradient-to-br from-green-50 to-emerald-50 border border-green-300'}`}>
                    <div className="flex items-center justify-between md:flex-col md:items-start gap-2">
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${isDark ? 'text-green-400' : 'text-green-600'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-green-400' : 'text-green-600'}`}>Received</p>
                      </div>
                      <p className={`text-xl md:text-2xl font-black ${isDark ? 'text-green-300' : 'text-green-700'}`}>₹{(inv.amountReceived || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>

                  {/* Pending Amount */}
                  <div className={`rounded-xl p-3 md:p-4 ${(inv.paymentPending || 0) > 0 ? isDark ? 'bg-gradient-to-br from-red-900/40 to-orange-900/40 border border-red-500/40' : 'bg-gradient-to-br from-red-50 to-orange-50 border border-red-300' : isDark ? 'bg-gradient-to-br from-gray-800 to-gray-700 border border-gray-600' : 'bg-gradient-to-br from-gray-100 to-gray-50 border border-gray-300'}`}>
                    <div className="flex items-center justify-between md:flex-col md:items-start gap-2">
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${(inv.paymentPending || 0) > 0 ? isDark ? 'text-red-400' : 'text-red-600' : isDark ? 'text-gray-500' : 'text-gray-400'}`} fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        <p className={`text-xs font-bold uppercase tracking-wider ${(inv.paymentPending || 0) > 0 ? isDark ? 'text-red-400' : 'text-red-600' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>Pending</p>
                      </div>
                      <p className={`text-xl md:text-2xl font-black ${(inv.paymentPending || 0) > 0 ? isDark ? 'text-red-300' : 'text-red-700' : isDark ? 'text-gray-500' : 'text-gray-400'}`}>₹{(inv.paymentPending || 0).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>

                {/* Edit Payment Button */}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditPaymentInvoice(inv)
                    setPaymentModalOpen(true)
                  }}
                  className={`w-full py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${isDark ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700' : 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'}`}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  <span>Edit Payment</span>
                </motion.button>

                {/* Footer Info */}
                <div className={`pt-3 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                  <span className={`text-xs font-semibold ${s}`}>Generated: {formatDate(inv.generatedDate)}</span>
                </div>
              </div>
            </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Invoice Modal */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Preview" size="xl">
        {viewInvoice && (
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-xl max-h-[65vh] overflow-y-auto">
              <InvoicePDF ref={invoiceRef} inv={viewInvoice} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={downloadPDF} className="bg-cyan-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-cyan-600 transition flex items-center justify-center gap-2">
                📥 Download PDF
              </button>
              <button onClick={shareWhatsApp} className="bg-green-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2">
                📱 Share WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Admin Payment Update Modal */}
      <AdminPaymentUpdateModal
        open={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false)
          setEditPaymentInvoice(null)
        }}
        invoice={editPaymentInvoice}
        isDark={isDark}
        onPaymentUpdated={() => {
          // Invoices will auto-update via onSnapshot listener
        }}
      />
    </div>
  )
}
