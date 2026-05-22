import { useEffect, useState, useRef } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import InvoicePDF from '../common/InvoicePDF'
import Modal from '../common/Modal'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

async function buildPDF(element, inv) {
  const canvas = await html2canvas(element, {
    scale: 2, backgroundColor: '#ffffff', windowWidth: 794, windowHeight: 1123
  })
  const pdf = new jsPDF('p', 'mm', 'a4')
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0,
    pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
  return { pdf, fileName: `FAC_Invoice_${inv.billNo}_${inv.customerName.replace(/\s+/g, '_')}.pdf` }
}

function whatsappMsg(inv) {
  let phone = (inv.customerPhone || '').replace(/[\s-]/g, '')
  if (!phone.startsWith('91') && phone.length === 10) phone = '91' + phone
  const msg = `*FRIENDS AQUA CARE - Invoice*\n\nBill No: ${inv.billNo}\nCustomer: ${inv.customerName}\nService: ${inv.serviceType}\nDate: ${inv.invoiceDate}\n\nBill: ₹${inv.billAmount.toLocaleString('en-IN')}\nReceived: ₹${inv.amountReceived.toLocaleString('en-IN')}\n${inv.paymentPending > 0 ? `Pending: ₹${inv.paymentPending.toLocaleString('en-IN')}\n` : ''}\nPDF downloaded. Please attach it in WhatsApp.\n\nThank you for choosing Friends Aqua Care!`
  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
}

export default function ViewInvoices() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [invoices, setInvoices] = useState([])
  const [filter, setFilter] = useState('all')
  const [viewInvoice, setViewInvoice] = useState(null)
  const [busy, setBusy] = useState(false)
  // one hidden ref per action (download/share from card)
  const hiddenRef = useRef(null)
  // ref inside modal
  const modalRef = useRef(null)

  useEffect(() => {
    if (!user) return
    return onSnapshot(
      query(collection(db, 'invoices'), where('technicianId', '==', user.uid)),
      snap => setInvoices(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0))
      )
    )
  }, [user])

  const filtered = (() => {
    if (filter === 'all') return invoices
    const now = new Date()
    return invoices.filter(inv => {
      const d = inv.generatedDate?.toDate
        ? inv.generatedDate.toDate()
        : new Date((inv.generatedDate?.seconds || 0) * 1000)
      if (filter === 'week') {
        const ago = new Date(now); ago.setDate(now.getDate() - 7); return d >= ago
      }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    })
  })()

  // Download from card (uses hidden element)
  const cardDownload = async (inv) => {
    setBusy(true)
    // set invoice so hidden element renders
    setViewInvoice(inv)
    await new Promise(r => setTimeout(r, 400)) // wait for render
    try {
      const { pdf, fileName } = await buildPDF(hiddenRef.current, inv)
      pdf.save(fileName)
      toast.success('📥 Downloaded!')
    } catch { toast.error('Failed to generate PDF') }
    setBusy(false)
    setViewInvoice(null)
  }

  // Share from card
  const cardShare = async (inv) => {
    setBusy(true)
    setViewInvoice(inv)
    await new Promise(r => setTimeout(r, 400))
    try {
      const { pdf, fileName } = await buildPDF(hiddenRef.current, inv)
      pdf.save(fileName)
      window.open(whatsappMsg(inv), '_blank')
      toast.success('📱 PDF downloaded! Attach in WhatsApp.')
    } catch { toast.error('Failed to generate PDF') }
    setBusy(false)
    setViewInvoice(null)
  }

  // Download from modal
  const modalDownload = async () => {
    setBusy(true)
    try {
      const { pdf, fileName } = await buildPDF(modalRef.current, viewInvoice)
      pdf.save(fileName)
      toast.success('📥 Downloaded!')
    } catch { toast.error('Failed to generate PDF') }
    setBusy(false)
  }

  // Share from modal
  const modalShare = async () => {
    setBusy(true)
    try {
      const { pdf, fileName } = await buildPDF(modalRef.current, viewInvoice)
      pdf.save(fileName)
      window.open(whatsappMsg(viewInvoice), '_blank')
      toast.success('📱 PDF downloaded! Attach in WhatsApp.')
    } catch { toast.error('Failed to generate PDF') }
    setBusy(false)
  }

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const card = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-5 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => window.history.back()}
          className={`p-2 rounded-xl border transition ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h2 className={`text-2xl font-black ${t}`}>My Invoices</h2>
          <p className={`text-sm mt-0.5 ${s}`}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} generated</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {[['all', `All (${invoices.length})`], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
              filter === key
                ? 'bg-cyan-500 text-white'
                : isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className={`${card} p-12 text-center`}>
          <p className="text-4xl mb-3">📄</p>
          <p className={`text-sm font-medium ${s}`}>No invoices found</p>
          <p className={`text-xs mt-1 ${s}`}>Generate invoices from Invoice Management</p>
        </div>
      )}

      {/* Invoice Cards */}
      <div className="space-y-3">
        {filtered.map((inv, i) => (
          <motion.div
            key={inv.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`${card} p-4`}
          >
            <div className="flex items-start justify-between gap-3">

              {/* Left — customer info */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <p className={`font-black text-base ${t}`}>{inv.customerName}</p>
                <p className={`text-xs ${s}`}>📞 {inv.customerPhone}</p>
                <p className={`text-xs ${s} truncate`}>📍 {inv.customerAddress}</p>
                <p className={`text-xs ${s}`}>📅 {inv.invoiceDate}</p>
              </div>

              {/* Right — buttons */}
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button
                  onClick={() => setViewInvoice(inv)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${isDark ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                >
                  👁 View
                </button>
                <button
                  onClick={() => cardDownload(inv)}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${isDark ? 'bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'}`}
                >
                  📥 Download
                </button>
                <button
                  onClick={() => cardShare(inv)}
                  disabled={busy}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition disabled:opacity-50 ${isDark ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
                >
                  📱 Share
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* View Modal */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Preview" size="xl">
        {viewInvoice && (
          <div className="space-y-4">
            <div className="bg-gray-100 p-4 rounded-xl max-h-[65vh] overflow-y-auto">
              <InvoicePDF ref={modalRef} inv={viewInvoice} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={modalDownload}
                disabled={busy}
                className="bg-cyan-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-cyan-600 transition disabled:opacity-60"
              >
                📥 Download PDF
              </button>
              <button
                onClick={modalShare}
                disabled={busy}
                className="bg-green-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-600 transition disabled:opacity-60"
              >
                📱 Share WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Hidden render target for card-level download/share */}
      <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0">
        {viewInvoice && <InvoicePDF ref={hiddenRef} inv={viewInvoice} />}
      </div>

    </div>
  )
}
