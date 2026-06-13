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
import { generateInvoice } from '../../utils/generateInvoice'

const formatDate = (ts) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function AnimatedCounter({ value, duration = 400 }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let start = 0
    const end = value
    const increment = end / (duration / 16)
    const timer = setInterval(() => {
      start += increment
      if (start >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 16)
    return () => clearInterval(timer)
  }, [value, duration])

  return <>{count.toLocaleString('en-IN')}</>
}

export default function Invoices() {
  const { isDark } = useTheme()
  const [invoices, setInvoices] = useState([])
  const [viewInvoice, setViewInvoice] = useState(null)
  const [filter, setFilter] = useState('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false)
  const [editPaymentInvoice, setEditPaymentInvoice] = useState(null)
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    return onSnapshot(collection(db, 'invoices'), snap => {
      const data = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(d => d.type !== 'sale' && (d.submittedByTechnician || d.billNo))
        .sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0))
      setInvoices(data)
      // Mark all unread invoices as viewed when admin opens the invoices page
      snap.docs.forEach(d => {
        if (d.data().submittedByTechnician && !d.data().adminViewed) {
          updateDoc(doc(db, 'invoices', d.id), { adminViewed: true, adminViewedAt: new Date() })
        }
      })
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

  // Date filtered invoices (for summary cards)
  const dateFilteredInvoices = invoices.filter(inv => {
    if (dateFilter === 'all') return true
    
    const invDate = inv.generatedDate?.toDate ? inv.generatedDate.toDate() : new Date(inv.generatedDate?.seconds * 1000)
    const now = new Date()
    
    if (dateFilter === 'today') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const todayEnd = new Date(todayStart)
      todayEnd.setDate(todayEnd.getDate() + 1)
      return invDate >= todayStart && invDate < todayEnd
    } else if (dateFilter === 'month') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return invDate >= monthStart && invDate < monthEnd
    } else if (dateFilter === 'custom' && customStartDate && customEndDate) {
      const startDate = new Date(customStartDate)
      const endDate = new Date(customEndDate)
      endDate.setDate(endDate.getDate() + 1) // Include end date
      return invDate >= startDate && invDate < endDate
    }
    
    return true
  })

  // Apply payment status filter on top of date filter
  const filteredInvoices = dateFilteredInvoices.filter(inv => {
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

  // Calculate totals based on date filtered invoices
  const totalRevenue = dateFilteredInvoices.reduce((s, i) => s + (i.billAmount || 0), 0)
  const totalReceived = dateFilteredInvoices.reduce((s, i) => s + (i.amountReceived || 0), 0)
  const totalPending = dateFilteredInvoices.reduce((s, i) => s + (i.paymentPending || 0), 0)
  const unread = invoices.filter(i => i.submittedByTechnician && !i.adminViewed).length

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div
        className="flex items-center justify-center px-4 py-4 rounded-full mx-4 mb-5 relative"
        style={isDark ? {
          background: '#151B2B',
          boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
        } : {
          background: '#e8f0f7',
          boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
        }}
      >
        <button
          onClick={() => window.history.back()}
          className={`absolute left-4 p-2 rounded-lg transition-all ${
            isDark
              ? 'hover:bg-white/10 text-white/70 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          INVOICES
        </h1>
      </div>

      <div className="space-y-5">

      {/* Date Filter */}
      <div className="space-y-3">
        <div
          className="rounded-2xl p-4"
          style={isDark ? {
            background: '#151B2B',
            boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
          } : {
            background: '#e8f0f7',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
          }}
        >
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1">
          {[
            { key: 'all', label: 'All Time', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
            { key: 'today', label: 'Today', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
            { key: 'month', label: 'This Month', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
            { key: 'custom', label: 'Custom Range', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l-4 4m0 0l-2-2m2 2V8" /></svg> },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                setDateFilter(tab.key)
                if (tab.key === 'custom') {
                  setShowCustomDatePicker(true)
                } else {
                  setShowCustomDatePicker(false)
                }
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap flex-shrink-0 ${
                dateFilter === tab.key
                  ? isDark ? 'text-blue-300' : 'text-blue-700'
                  : isDark ? 'text-white/60' : 'text-gray-600'
              }`}
              style={dateFilter === tab.key
                ? isDark
                  ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.4)' }
                  : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)', border: '1px solid rgba(59,130,246,0.4)' }
                : isDark
                  ? { background: '#151B2B', boxShadow: '-3px -3px 7px rgba(255,255,255,0.04), 3px 3px 7px rgba(0,0,0,0.6)' }
                  : { background: '#e8f0f7', boxShadow: '-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.5)' }
              }
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        </div>

        {/* Custom Date Range Picker */}
        {showCustomDatePicker && dateFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`${cardBase} p-4 space-y-3`}
          >
            <p className={`text-sm font-bold ${t}`}>Select Date Range</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={`text-xs font-semibold mb-1.5 block ${s}`}>Start Date</label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
              <div>
                <label className={`text-xs font-semibold mb-1.5 block ${s}`}>End Date</label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg text-sm font-medium border ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                />
              </div>
            </div>
            {customStartDate && customEndDate && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setCustomStartDate('')
                    setCustomEndDate('')
                  }}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  Clear
                </button>
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { 
            label: 'Total Billed', 
            value: totalRevenue, 
            valueColor: isDark ? 'text-cyan-300' : 'text-cyan-700'
          },
          { 
            label: 'Received', 
            value: totalReceived, 
            valueColor: isDark ? 'text-green-300' : 'text-green-700'
          },
          { 
            label: 'Pending', 
            value: totalPending, 
            valueColor: isDark ? 'text-red-300' : 'text-red-700'
          },
        ].map(card => (
          <div
            key={card.label}
            className="rounded-xl p-3"
            style={isDark ? {
              background: '#151B2B',
              boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
            } : {
              background: '#e8f0f7',
              boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
            }}
          >
            <p className={`text-xs font-bold mb-2 ${s}`}>{card.label}</p>
            <p className={`text-lg font-black ${card.valueColor}`}>₹<AnimatedCounter value={card.value} duration={400} /></p>
          </div>
        ))}
      </div>

      {/* Payment Status Filter */}
      <div
        className="rounded-2xl p-4"
        style={isDark ? {
          background: '#151B2B',
          boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
        } : {
          background: '#e8f0f7',
          boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
        }}
      >
        <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'pending', label: 'Pending Payment' },
            { key: 'paid', label: 'Fully Paid' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition whitespace-nowrap flex-shrink-0 ${
                filter === tab.key
                  ? isDark ? 'text-cyan-300' : 'text-cyan-700'
                  : isDark ? 'text-white/60' : 'text-gray-600'
              }`}
              style={filter === tab.key
                ? isDark
                  ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)', border: '1px solid rgba(6,182,212,0.4)' }
                  : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)', border: '1px solid rgba(6,182,212,0.4)' }
                : isDark
                  ? { background: '#151B2B', boxShadow: '-3px -3px 7px rgba(255,255,255,0.04), 3px 3px 7px rgba(0,0,0,0.6)' }
                  : { background: '#e8f0f7', boxShadow: '-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.5)' }
              }
            >
              {tab.label}
            </button>
          ))}
        </div>
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
              <div
                className="sticky top-0 z-10 backdrop-blur-md py-3.5 px-5 rounded-xl"
                style={isDark ? {
                  background: 'rgba(21,27,43,0.95)',
                  boxShadow: '-3px -3px 8px rgba(255,255,255,0.03), 3px 3px 8px rgba(0,0,0,0.5)'
                } : {
                  background: 'rgba(232,240,247,0.95)',
                  boxShadow: '-4px -4px 10px rgba(255,255,255,0.9), 4px 4px 10px rgba(163,177,198,0.4)'
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                      <svg className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <h3 className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                      {date}
                    </h3>
                  </div>
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full ${isDark ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'bg-indigo-50 text-indigo-700 border border-indigo-200'}`}>
                    {dateInvoices.length} {dateInvoices.length !== 1 ? 'invoices' : 'invoice'}
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
              className="rounded-2xl overflow-hidden cursor-pointer transition-all"
              style={isDark ? {
                background: '#151B2B',
                boxShadow: !inv.adminViewed && inv.submittedByTechnician
                  ? '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(6,182,212,0.5)'
                  : '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
              } : {
                background: '#e8f0f7',
                boxShadow: !inv.adminViewed && inv.submittedByTechnician
                  ? '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5), 0 0 0 1px rgba(6,182,212,0.5)'
                  : '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
              }}
            >
              {/* Top Bar with Invoice Number and Status */}
              <div
                className="px-5 py-3 flex items-center justify-between"
                style={isDark
                  ? { background: '#0B0F19', boxShadow: '0 2px 6px rgba(0,0,0,0.5)' }
                  : { background: '#dce6f0', boxShadow: '0 2px 6px rgba(163,177,198,0.4)' }
                }
              >
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-black ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{inv.billNo}</span>
                  {!inv.adminViewed && inv.submittedByTechnician && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold animate-pulse shadow-lg">
                      ✨ NEW
                    </span>
                  )}
                </div>
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
                {(inv.paymentPending || 0) > 0 && (
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
                )}

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

      {/* Invoice Actions Modal - View Only for Admin */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Actions" size="md">
        {viewInvoice && (
          <div className="space-y-4">

            {/* Header Banner */}
            <div className={`relative overflow-hidden rounded-2xl p-5 ${
              isDark ? 'bg-gradient-to-br from-slate-800 to-slate-700 border border-white/10' : 'bg-gradient-to-br from-slate-900 to-slate-700'
            }`}>
              {/* Decorative circle */}
              <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white/5" />
              <div className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full bg-white/5" />

              <div className="relative flex items-start gap-4">
                <div className="p-2.5 rounded-xl bg-white/10 flex-shrink-0">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-0.5">Invoice</p>
                  <h2 className="text-white text-xl font-black truncate">#{viewInvoice.billNo}</h2>
                  <p className="text-white/70 text-sm font-medium mt-0.5 truncate">{viewInvoice.customerName}</p>
                </div>
                <span className={`flex-shrink-0 text-xs font-bold px-2.5 py-1 rounded-full ${
                  (viewInvoice.paymentPending || 0) > 0
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                    : 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/30'
                }`}>
                  {(viewInvoice.paymentPending || 0) > 0 ? 'PARTIAL' : 'PAID'}
                </span>
              </div>
            </div>

            {/* Grand Total Card */}
            <div className={`rounded-2xl p-4 border flex items-center justify-between ${
              isDark ? 'bg-gray-800/60 border-white/10' : 'bg-gray-50 border-gray-200'
            }`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${
                  isDark ? 'text-gray-400' : 'text-gray-500'
                }`}>Grand Total</p>
                <p className={`text-3xl font-black ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>₹{(viewInvoice.billAmount || 0).toLocaleString('en-IN')}</p>
              </div>

            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
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
                    paymentMode: viewInvoice.modeOfPayment || 'N/A',
                    serviceDate: viewInvoice.invoiceDate || null,
                    products: (() => {
                      const comps = (viewInvoice.components || [])
                      if (comps.length > 0) {
                        return comps.map(c => ({
                          name: c.name || 'N/A',
                          qty: Number(c.quantity) || 0,
                          price: Number(c.price) || 0,
                          amount: Number(c.amount) || 0
                        }))
                      }
                      // Fallback to products field
                      return (viewInvoice.products || []).map(p => ({
                        name: p.name || p.productName || 'N/A',
                        qty: Number(p.qty || p.quantity) || 0,
                        price: Number(p.price) || 0,
                        amount: Number(p.amount) || 0
                      }))
                    })(),
                  })
                  toast.success('Invoice downloaded!')
                }}
                className={`flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-lg shadow-blue-500/20'
                    : 'bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 shadow-lg shadow-blue-500/25'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  const phone = viewInvoice.customerPhone.replace(/\D/g, '')
                  const message = `Hi ${viewInvoice.customerName}, your invoice for ${viewInvoice.serviceType} service is ready. Invoice #${viewInvoice.billNo}`
                  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
                  toast.success('Invoice shared!')
                }}
                className={`flex items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-bold text-white transition-all ${
                  isDark
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 shadow-lg shadow-green-500/20'
                    : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 shadow-lg shadow-green-500/25'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </motion.button>
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
    </div>
  )
}
