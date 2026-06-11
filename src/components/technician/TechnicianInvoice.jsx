import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, addDoc, query, where, serverTimestamp, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'
import InvoicePDF from '../common/InvoicePDF'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { motion } from 'framer-motion'

function formatDate(ts) {
  if (!ts) return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function generateBillNo() {
  const date = new Date()
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
  return `FAC${year}${month}${random}`
}

const PAYMENT_MODES = ['Cash', 'UPI', 'Net Banking', 'None']

export default function TechnicianInvoice() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const [myJobs, setMyJobs] = useState([])
  const [myInvoices, setMyInvoices] = useState([])
  const [myStock, setMyStock] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [form, setForm] = useState({
    customerName: '', customerPhone: '', customerAddress: '',
    serviceType: '', components: [],
    billAmount: '', amountReceived: '', modeOfPayment: 'Cash',
    date: formatDate(null)
  })
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    if (!user) return
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid)),
      snap => setMyJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    const u2 = onSnapshot(
      query(collection(db, 'invoices'), where('technicianId', '==', user.uid)),
      snap => setMyInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0)))
    )
    const u3 = onSnapshot(
      query(collection(db, 'technician_stock'), where('technicianId', '==', user.uid), where('status', '==', 'active')),
      snap => setMyStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2(); u3() }
  }, [user])

  // Filter invoices by period
  const getFilteredInvoices = () => {
    if (filterPeriod === 'all') return myInvoices
    const now = new Date()
    return myInvoices.filter(inv => {
      const d = inv.generatedDate?.toDate ? inv.generatedDate.toDate() : new Date(inv.generatedDate?.seconds * 1000)
      if (filterPeriod === 'week') {
        const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7)
        return d >= weekAgo
      }
      if (filterPeriod === 'month') {
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      }
      return true
    })
  }

  const toggleJobStatus = async (job) => {
    setToggling(true)
    try {
      const newStatus = job.status === 'completed' ? 'in_progress' : 'completed'
      await updateDoc(doc(db, 'service_jobs', job.id), {
        status: newStatus,
        ...(newStatus === 'completed' ? { completedAt: serverTimestamp() } : {})
      })
      toast.success(newStatus === 'completed' ? '✅ Marked as completed!' : '🔄 Marked as in progress')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setToggling(false)
    }
  }

  const openInvoiceForm = (job) => {
    setSelectedJob(job)
    setForm({
      customerName: job.customerName || '',
      customerPhone: job.customerPhone || '',
      customerAddress: job.customerAddress || '',
      serviceType: job.serviceType || 'Service / Repair',
      components: [],
      billAmount: '', amountReceived: '', modeOfPayment: 'Cash',
      date: formatDate(null)
    })
  }

  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, { name: '', quantity: 1, price: 0, amount: 0 }] }))
  const removeComponent = (i) => setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }))
  const updateComponent = (i, key, val) => setForm(f => {
    const components = [...f.components]
    const updated = { ...components[i], [key]: val }
    if (key === 'name') {
      const stockItem = myStock.find(s => s.productName === val)
      updated.price = Number(stockItem?.price) || 0
      updated.quantity = Number(updated.quantity) || 1
      updated.amount = Number(updated.price) * Number(updated.quantity)
    } else if (key === 'quantity') {
      updated.quantity = Number(val) || 0
      updated.price = Number(updated.price) || 0
      updated.amount = Number(updated.price) * Number(updated.quantity)
    } else if (key === 'price') {
      updated.price = Number(val) || 0
      updated.quantity = Number(updated.quantity) || 1
      updated.amount = Number(updated.price) * Number(updated.quantity)
    }
    components[i] = updated
    return { ...f, components }
  })

  const componentsTotal = form.components.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  const handleGenerate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const billNo = generateBillNo()
      const pending = Number(form.billAmount) - Number(form.amountReceived)
      const cleanedComponents = form.components.map(comp => ({
        name: comp.name || '',
        quantity: Number(comp.quantity) || 0,
        price: Number(comp.price) || 0,
        amount: Number(comp.amount) || 0
      }))

      const invoiceData = {
        billNo,
        jobId: selectedJob.id,
        customerId: selectedJob.customerId || '',
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        customerAddress: form.customerAddress,
        serviceType: form.serviceType,
        technicianId: user.uid,
        technicianName: profile?.name || '',
        components: cleanedComponents,
        componentsTotal,
        billAmount: Number(form.billAmount),
        amountReceived: Number(form.amountReceived),
        paymentPending: pending < 0 ? 0 : pending,
        modeOfPayment: form.modeOfPayment,
        invoiceDate: form.date,
        submittedByTechnician: true,
        adminViewed: false,
        generatedDate: serverTimestamp(),
      }
      const docRef = await addDoc(collection(db, 'invoices'), invoiceData)

      // Update used stock
      for (const comp of form.components) {
        const stockItem = myStock.find(s => s.productName === comp.name)
        if (stockItem && comp.quantity > 0) {
          await updateDoc(doc(db, 'technician_stock', stockItem.id), {
            usedQuantity: (stockItem.usedQuantity || 0) + Number(comp.quantity)
          })
          await addDoc(collection(db, 'stock_transactions'), {
            type: 'job_usage',
            jobId: selectedJob.id,
            productId: stockItem.productId,
            productName: stockItem.productName,
            usedQuantity: Number(comp.quantity),
            damagedQuantity: 0,
            technicianId: user.uid,
            technicianName: profile?.name || '',
            timestamp: serverTimestamp(),
          })
        }
      }

      // Notify admin
      await addDoc(collection(db, 'notifications'), {
        type: 'invoice_generated',
        invoiceId: docRef.id,
        billNo,
        technicianId: user.uid,
        technicianName: profile?.name || '',
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        billAmount: Number(form.billAmount),
        amountReceived: Number(form.amountReceived),
        paymentPending: pending < 0 ? 0 : pending,
        read: false,
        createdAt: serverTimestamp(),
        message: `New invoice ${billNo} by ${profile?.name || 'Technician'} for ${form.customerName}`,
      })

      toast.success('✅ Invoice generated and admin notified!')
      setSelectedJob(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
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
    } catch (err) {
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

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`
  const inputCls = `w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`
  const labelCls = `text-xs font-semibold uppercase ${isDark ? 'text-white/50' : 'text-gray-500'}`

  const filteredInvoices = getFilteredInvoices()

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className={`p-2 rounded-xl border transition ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className={`text-2xl font-black ${t}`}>Invoice Management</h2>
          <p className={`text-sm mt-0.5 ${s}`}>Mark jobs complete and generate invoices</p>
        </div>
      </div>

      {/* MY JOBS */}
      <div className={`${cardBase} overflow-hidden`}>
        <div className={`px-5 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
          <h3 className={`font-black text-base ${t}`}>My Jobs</h3>
          <p className={`text-xs mt-0.5 ${s}`}>Toggle to completed, then generate invoice</p>
        </div>
        <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
          {myJobs.length === 0 ? (
            <div className="p-10 text-center">
              <p className="text-3xl mb-2">📋</p>
              <p className={`text-sm ${s}`}>No jobs assigned yet</p>
            </div>
          ) : myJobs.map(job => {
            const isCompleted = job.status === 'completed'
            const hasInvoice = myInvoices.some(inv => inv.jobId === job.id)
            return (
              <div key={job.id} className={`p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className={`font-bold text-sm ${t}`}>{job.customerName}</p>
                      {hasInvoice && <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>✓ Invoice Done</span>}
                    </div>
                    <p className={`text-xs ${s}`}>📞 {job.customerPhone}</p>
                    <p className={`text-xs ${s}`}>📍 {job.customerAddress}</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${isCompleted ? 'text-green-500' : 'text-amber-500'}`}>
                        {isCompleted ? 'Completed' : 'Pending'}
                      </span>
                      <button
                        onClick={() => toggleJobStatus(job)}
                        disabled={toggling}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-60 ${isCompleted ? 'bg-green-500' : isDark ? 'bg-white/20' : 'bg-gray-300'}`}
                      >
                        <motion.div
                          animate={{ x: isCompleted ? 22 : 2 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                        />
                      </button>
                    </div>
                    {isCompleted && !hasInvoice && (
                      <button
                        onClick={() => openInvoiceForm(job)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl bg-cyan-500 text-white hover:bg-cyan-600 transition"
                      >
                        📄 Generate Invoice
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* VIEW INVOICES */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className={`font-black text-base ${t}`}>📋 View Invoices ({myInvoices.length})</h3>
          <div className="flex gap-2">
            {[['all', 'All'], ['week', 'This Week'], ['month', 'This Month']].map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterPeriod(key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterPeriod === key ? 'bg-cyan-500 text-white' : isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <div className={`${cardBase} p-10 text-center`}>
            <p className="text-3xl mb-2">📄</p>
            <p className={`text-sm ${s}`}>No invoices found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredInvoices.map(inv => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setViewInvoice(inv)}
                className={`${cardBase} p-4 cursor-pointer transition hover:border-cyan-400`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className={`font-bold text-sm ${t}`}>{inv.customerName}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${inv.paymentPending > 0 ? isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700' : isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                        {inv.paymentPending > 0 ? 'Pending' : '✓ Paid'}
                      </span>
                    </div>
                    <p className={`text-xs ${s}`}>📞 {inv.customerPhone} • {inv.invoiceDate}</p>
                    <div className="flex gap-3 mt-1.5 flex-wrap">
                      <p className={`text-xs font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>₹{inv.billAmount.toLocaleString('en-IN')}</p>
                      <p className={`text-xs font-bold text-green-500`}>Rcvd: ₹{inv.amountReceived.toLocaleString('en-IN')}</p>
                      {inv.paymentPending > 0 && <p className="text-xs font-bold text-red-500">Due: ₹{inv.paymentPending.toLocaleString('en-IN')}</p>}
                    </div>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                    {inv.billNo}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* GENERATE INVOICE MODAL */}
      <Modal open={!!selectedJob} onClose={() => setSelectedJob(null)} title="Generate Invoice" size="xl">
        {selectedJob && (
          <form onSubmit={handleGenerate} className="space-y-4 max-h-[75vh] overflow-y-auto px-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Customer Name</label>
                <input type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Phone Number</label>
                <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} required className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Location / Address</label>
              <textarea value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} required rows={2} className={`${inputCls} resize-none`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Service Type</label>
                <input type="text" value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} required className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Date</label>
                <input type="text" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required className={inputCls} />
              </div>
            </div>

            {/* Components */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={labelCls}>Components Used</label>
                <button type="button" onClick={addComponent} className="text-xs font-bold text-cyan-500 hover:text-cyan-600">+ Add</button>
              </div>
              {form.components.map((comp, i) => (
                <div key={i} className="flex gap-2 mb-2 items-center flex-wrap">
                  <select value={comp.name} onChange={e => updateComponent(i, 'name', e.target.value)} className={`flex-1 min-w-[120px] border rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}>
                    <option value="">Select component</option>
                    {myStock.map(s => (
                      <option key={s.id} value={s.productName}>{s.productName}</option>
                    ))}
                  </select>
                  <input type="number" value={comp.quantity} onChange={e => updateComponent(i, 'quantity', Number(e.target.value))} min={1} placeholder="Qty" className={`w-16 border rounded-xl px-2 py-2 text-xs text-center focus:outline-none focus:ring-2 focus:ring-cyan-400 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                  <input type="number" value={comp.price} onChange={e => updateComponent(i, 'price', Number(e.target.value))} min={0} placeholder="Unit ₹" className={`w-20 border rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`} />
                  <span className={`text-xs font-bold min-w-[52px] text-right ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>₹{Number(comp.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <button type="button" onClick={() => removeComponent(i)} className="text-red-400 text-lg px-1">×</button>
                </div>
              ))}
            </div>

            {/* Bill Amount + Amount Received + Mode of Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Bill Amount (₹)</label>
                <input type="number" value={form.billAmount} onChange={e => setForm(f => ({ ...f, billAmount: e.target.value }))} required min="0" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Amount Received (₹)</label>
                <input type="number" value={form.amountReceived} onChange={e => setForm(f => ({ ...f, amountReceived: e.target.value }))} required min="0" placeholder="0 if pending" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Mode of Payment</label>
                <select value={form.modeOfPayment} onChange={e => setForm(f => ({ ...f, modeOfPayment: e.target.value }))} className={inputCls}>
                  {PAYMENT_MODES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Summary */}
            {Number(form.billAmount) > 0 && (
              <div className={`rounded-xl p-4 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={s}>Components Total:</span>
                  <span className={`font-bold ${t}`}>₹{componentsTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={s}>Bill Amount:</span>
                  <span className={`font-bold ${t}`}>₹{Number(form.billAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={s}>Amount Received:</span>
                  <span className="font-bold text-green-500">₹{Number(form.amountReceived || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className={s}>Mode of Payment:</span>
                  <span className={`font-bold ${t}`}>{form.modeOfPayment}</span>
                </div>
                {(Number(form.billAmount) - Number(form.amountReceived || 0)) > 0 && (
                  <div className="flex justify-between border-t border-red-200 pt-2 mt-2">
                    <span className="font-bold text-red-500">Payment Pending:</span>
                    <span className="font-black text-red-500">₹{(Number(form.billAmount) - Number(form.amountReceived || 0)).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setSelectedJob(null)} className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition ${isDark ? 'border-white/10 text-white/60 hover:bg-white/10' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-cyan-500 text-white hover:bg-cyan-600 transition disabled:opacity-60">
                {saving ? 'Generating...' : '📄 Generate Invoice'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* VIEW INVOICE MODAL */}
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
