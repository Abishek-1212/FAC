import { useEffect, useState } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

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

  // Download from card
  const cardDownload = async (inv) => {
    console.log('='.repeat(60))
    console.log('VIEWINVOICES CARD DOWNLOAD CLICKED')
    console.log('Full invoice object:', JSON.stringify(inv, null, 2))
    console.log('products field:', inv.products)
    console.log('products type:', typeof inv.products)
    console.log('products length:', inv.products?.length)
    console.log('='.repeat(60))
    setBusy(true)
    try {
      generateInvoice({
        invoiceNumber: inv.billNo,
        customerName: inv.customerName || 'N/A',
        customerPhone: inv.customerPhone || 'N/A',
        customerAddress: inv.customerAddress || 'N/A',
        technicianName: inv.technicianName || 'N/A',
        serviceType: inv.serviceType || 'N/A',
        problemDescription: inv.problemDescription || '',
        totalAmount: inv.totalAmount || 0,
        discountType: inv.discountType || 'percentage',
        discountValue: inv.discountValue || 0,
        discountAmount: inv.discountAmount || 0,
        grandTotal: inv.billAmount || 0,
        amountReceived: inv.amountReceived || 0,
        paymentMode: inv.modeOfPayment || 'Cash',
        serviceDate: inv.invoiceDate || null,
        products: (inv.products || []).map(p => ({
          name: p.name || 'N/A',
          qty: Number(p.qty) || 0,
          price: Number(p.price) || 0
        })),
      })
      toast.success('📥 Downloaded!')
    } catch (err) {
      toast.error('Failed to generate PDF')
    }
    setBusy(false)
  }

  // Share from card
  const cardShare = async (inv) => {
    setBusy(true)
    try {
      generateInvoice({
        invoiceNumber: inv.billNo,
        customerName: inv.customerName || 'N/A',
        customerPhone: inv.customerPhone || 'N/A',
        customerAddress: inv.customerAddress || 'N/A',
        technicianName: inv.technicianName || 'N/A',
        serviceType: inv.serviceType || 'N/A',
        problemDescription: inv.problemDescription || '',
        totalAmount: inv.totalAmount || 0,
        discountType: inv.discountType || 'percentage',
        discountValue: inv.discountValue || 0,
        discountAmount: inv.discountAmount || 0,
        grandTotal: inv.billAmount || 0,
        amountReceived: inv.amountReceived || 0,
        paymentMode: inv.modeOfPayment || 'Cash',
        serviceDate: inv.invoiceDate || null,
        products: (inv.products || []).map(p => ({
          name: p.name || 'N/A',
          qty: Number(p.qty) || 0,
          price: Number(p.price) || 0
        })),
      })
      window.open(whatsappMsg(inv), '_blank')
      toast.success('📱 PDF downloaded! Attach in WhatsApp.')
    } catch (err) {
      toast.error('Failed to generate PDF')
    }
    setBusy(false)
  }

  // Download from modal
  const modalDownload = async () => {
    setBusy(true)
    try {
      generateInvoice({
        invoiceNumber: viewInvoice.billNo,
        customerName: viewInvoice.customerName || 'N/A',
        customerPhone: viewInvoice.customerPhone || 'N/A',
        customerAddress: viewInvoice.customerAddress || 'N/A',
        technicianName: viewInvoice.technicianName || 'N/A',
        serviceType: viewInvoice.serviceType || 'N/A',
        problemDescription: viewInvoice.problemDescription || '',
        totalAmount: viewInvoice.totalAmount || 0,
        discountType: viewInvoice.discountType || 'percentage',
        discountValue: viewInvoice.discountValue || 0,
        discountAmount: viewInvoice.discountAmount || 0,
        grandTotal: viewInvoice.billAmount || 0,
        amountReceived: viewInvoice.amountReceived || 0,
        paymentMode: viewInvoice.modeOfPayment || 'Cash',
        serviceDate: viewInvoice.invoiceDate || null,
        products: (viewInvoice.products || []).map(p => ({
          name: p.name || 'N/A',
          qty: Number(p.qty) || 0,
          price: Number(p.price) || 0
        })),
      })
      toast.success('📥 Downloaded!')
    } catch (err) {
      toast.error('Failed to generate PDF')
    }
    setBusy(false)
  }

  // Share from modal
  const modalShare = async () => {
    setBusy(true)
    try {
      generateInvoice({
        invoiceNumber: viewInvoice.billNo,
        customerName: viewInvoice.customerName || 'N/A',
        customerPhone: viewInvoice.customerPhone || 'N/A',
        customerAddress: viewInvoice.customerAddress || 'N/A',
        technicianName: viewInvoice.technicianName || 'N/A',
        serviceType: viewInvoice.serviceType || 'N/A',
        problemDescription: viewInvoice.problemDescription || '',
        totalAmount: viewInvoice.totalAmount || 0,
        discountType: viewInvoice.discountType || 'percentage',
        discountValue: viewInvoice.discountValue || 0,
        discountAmount: viewInvoice.discountAmount || 0,
        grandTotal: viewInvoice.billAmount || 0,
        amountReceived: viewInvoice.amountReceived || 0,
        paymentMode: viewInvoice.modeOfPayment || 'Cash',
        serviceDate: viewInvoice.invoiceDate || null,
        products: (viewInvoice.products || []).map(p => ({
          name: p.name || 'N/A',
          qty: Number(p.qty) || 0,
          price: Number(p.price) || 0
        })),
      })
      window.open(whatsappMsg(viewInvoice), '_blank')
      toast.success('📱 PDF downloaded! Attach in WhatsApp.')
    } catch (err) {
      toast.error('Failed to generate PDF')
    }
    setBusy(false)
  }

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const card = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`

  return (
    <div className="space-y-5 pb-20 md:pb-0">

      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${t}`}>My Invoices</h2>
        <p className={`text-sm mt-0.5 ${s}`}>{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} generated</p>
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


    </div>
  )
}
