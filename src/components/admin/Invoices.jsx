import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import InvoicePDF from '../common/InvoicePDF'
import Modal from '../common/Modal'
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
        <button onClick={() => window.history.back()} className={`p-2 rounded-xl border transition ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className={`text-2xl font-black ${t}`}>Invoices</h2>
          <p className={`text-sm mt-0.5 ${s}`}>All invoices from technicians</p>
        </div>
        {unread > 0 && (
          <span className="ml-auto bg-red-500 text-white text-xs font-black px-2.5 py-1 rounded-full">
            {unread} new
          </span>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total Billed', value: `₹${totalRevenue.toLocaleString('en-IN')}`, color: isDark ? 'text-cyan-400' : 'text-cyan-600' },
          { label: 'Received', value: `₹${totalReceived.toLocaleString('en-IN')}`, color: 'text-green-500' },
          { label: 'Pending', value: `₹${totalPending.toLocaleString('en-IN')}`, color: 'text-red-500' },
        ].map(card => (
          <div key={card.label} className={`${cardBase} p-4`}>
            <p className={`text-xs font-semibold ${s}`}>{card.label}</p>
            <p className={`text-lg font-black mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'All', count: invoices.length },
          { key: 'pending', label: 'Pending Payment', count: invoices.filter(i => (i.paymentPending || 0) > 0).length },
          { key: 'paid', label: 'Fully Paid', count: invoices.filter(i => (i.paymentPending || 0) === 0).length },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${filter === tab.key ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            {tab.label} ({tab.count})
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
        <div className="grid gap-3">
          {filteredInvoices.map((inv, i) => (
            <motion.div
              key={inv.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => openInvoice(inv)}
              className={`${cardBase} p-4 cursor-pointer transition hover:border-cyan-400 ${!inv.adminViewed && inv.submittedByTechnician ? isDark ? 'border-cyan-500/50' : 'border-cyan-300' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className={`font-bold text-sm ${t}`}>{inv.customerName}</p>
                    {!inv.adminViewed && inv.submittedByTechnician && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500 text-white font-bold">New</span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full ${(inv.paymentPending || 0) > 0 ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700' : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                      {(inv.paymentPending || 0) > 0 ? 'Pending' : '✓ Paid'}
                    </span>
                  </div>
                  <p className={`text-xs ${s}`}>📞 {inv.customerPhone}</p>
                  <p className={`text-xs ${s}`}>👷 {inv.technicianName} • {inv.invoiceDate}</p>
                  <div className="flex gap-3 mt-1.5 flex-wrap">
                    <p className={`text-xs font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>₹{(inv.billAmount || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs font-bold text-green-500">Rcvd: ₹{(inv.amountReceived || 0).toLocaleString('en-IN')}</p>
                    {(inv.paymentPending || 0) > 0 && <p className="text-xs font-bold text-red-500">Due: ₹{inv.paymentPending.toLocaleString('en-IN')}</p>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                    {inv.billNo}
                  </span>
                  <p className={`text-xs mt-1.5 ${s}`}>{formatDate(inv.generatedDate)}</p>
                </div>
              </div>
            </motion.div>
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
    </div>
  )
}
