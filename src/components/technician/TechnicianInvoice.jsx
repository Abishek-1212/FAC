import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, addDoc, query, where, serverTimestamp, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'
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

export default function TechnicianInvoice() {
  const { user, profile } = useAuth()
  const { isDark } = useTheme()
  const [myJobs, setMyJobs] = useState([])
  const [myInvoices, setMyInvoices] = useState([])
  const [myStock, setMyStock] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    serviceType: '',
    components: [],
    billAmount: '',
    amountReceived: '',
    date: formatDate(null)
  })
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    if (!user) return
    // Get all jobs assigned to this technician
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', user.uid)),
      snap => setMyJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    // Get all invoices created by this technician
    const u2 = onSnapshot(
      query(collection(db, 'invoices'), where('technicianId', '==', user.uid)),
      snap => setMyInvoices(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0))
      )
    )
    // Get technician's stock
    const u3 = onSnapshot(
      query(collection(db, 'stock_assignments'), where('technicianId', '==', user.uid), where('status', '==', 'assigned')),
      snap => setMyStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2(); u3() }
  }, [user])

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
      billAmount: '',
      amountReceived: '',
      date: formatDate(null)
    })
  }

  const addComponent = () => setForm(f => ({ ...f, components: [...f.components, { name: '', quantity: 1, amount: 0 }] }))
  const removeComponent = (i) => setForm(f => ({ ...f, components: f.components.filter((_, idx) => idx !== i) }))
  const updateComponent = (i, key, val) => setForm(f => {
    const components = [...f.components]
    components[i] = { ...components[i], [key]: val }
    return { ...f, components }
  })

  const componentsTotal = form.components.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  const handleGenerate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const billNo = generateBillNo()
      
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
        components: form.components,
        componentsTotal,
        billAmount: Number(form.billAmount),
        amountReceived: Number(form.amountReceived),
        paymentPending: Number(form.billAmount) - Number(form.amountReceived),
        invoiceDate: form.date,
        submittedByTechnician: true,
        adminViewed: false,
        generatedDate: serverTimestamp(),
      }
      
      await addDoc(collection(db, 'invoices'), invoiceData)
      
      // Reduce stock
      for (const comp of form.components) {
        const stockItem = myStock.find(s => s.productName === comp.name)
        if (stockItem && comp.quantity > 0) {
          const newUsed = (stockItem.usedQuantity || 0) + comp.quantity
          await updateDoc(doc(db, 'stock_assignments', stockItem.id), {
            usedQuantity: newUsed
          })
        }
      }
      
      toast.success('✅ Invoice generated successfully!')
      setSelectedJob(null)
      setForm({
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        serviceType: '',
        components: [],
        billAmount: '',
        amountReceived: '',
        date: formatDate(null)
      })
    } catch (err) {
      console.error('Error creating invoice:', err)
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const downloadPDF = async () => {
    if (!invoiceRef.current) return
    try {
      const canvas = await html2canvas(invoiceRef.current, { 
        scale: 2, 
        backgroundColor: '#ffffff',
        windowWidth: 794, // A4 width in pixels at 96 DPI
        windowHeight: 1123 // A4 height in pixels at 96 DPI
      })
      const pdf = new jsPDF('p', 'mm', 'a4')
      const imgData = canvas.toDataURL('image/png')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
      const fileName = `FAC_Invoice_${viewInvoice.billNo}_${viewInvoice.customerName.replace(/\s+/g, '_')}.pdf`
      pdf.save(fileName)
      toast.success('📥 PDF downloaded!')
      return pdf
    } catch (err) {
      console.error('PDF generation error:', err)
      toast.error('Failed to generate PDF')
      return null
    }
  }

  const shareWhatsApp = async () => {
    if (!viewInvoice) return
    
    try {
      // First download the PDF
      toast.loading('Generating PDF...')
      await downloadPDF()
      toast.dismiss()
      
      // Then open WhatsApp with message
      const message = `*FRIENDS AQUA CARE - Invoice*\n\nBill No: ${viewInvoice.billNo}\nCustomer: ${viewInvoice.customerName}\nPhone: ${viewInvoice.customerPhone}\nService: ${viewInvoice.serviceType}\nBill Amount: ₹${viewInvoice.billAmount.toLocaleString('en-IN')}\nAmount Received: ₹${viewInvoice.amountReceived.toLocaleString('en-IN')}\n${viewInvoice.paymentPending > 0 ? `Pending: ₹${viewInvoice.paymentPending.toLocaleString('en-IN')}\n` : ''}\n\nPDF has been downloaded. Please attach it manually in WhatsApp.\n\nThank you for choosing Friends Aqua Care!`
      
      // Open WhatsApp Web (allows selecting contact)
      const url = `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`
      window.open(url, '_blank')
      
      toast.success('📱 PDF downloaded! Now attach it in WhatsApp')
    } catch (err) {
      toast.error('Failed to share')
    }
  }

  const completedJobs = myJobs.filter(j => j.status === 'completed')
  const pendingJobs = myJobs.filter(j => j.status !== 'completed')

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Invoice Management</h2>
        <p className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Mark jobs as completed and generate invoices</p>
      </div>

      {/* My Jobs with Status Toggle */}
      <div className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}>
        <div className={`px-6 py-4 border-b ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
          <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>My Jobs</h3>
          <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Toggle status to completed, then generate invoice</p>
        </div>

        <div className={`divide-y ${isDark ? 'divide-white/5' : 'divide-gray-100'}`}>
          {myJobs.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">📋</p>
              <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>No jobs assigned yet</p>
            </div>
          ) : (
            myJobs.map(job => {
              const isCompleted = job.status === 'completed'
              const hasInvoice = myInvoices.some(inv => inv.jobId === job.id)
              
              return (
                <motion.div
                  key={job.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`p-4 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'} transition`}
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Job Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.customerName}</p>
                        {hasInvoice && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'}`}>
                            ✓ Invoice Generated
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>📞 {job.customerPhone}</p>
                      <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>📍 {job.customerAddress}</p>
                      <p className={`text-xs mt-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{job.problemDescription}</p>
                    </div>

                    {/* Status Toggle & Generate Button */}
                    <div className="flex flex-col items-end gap-2">
                      {/* Toggle */}
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${isCompleted ? (isDark ? 'text-green-400' : 'text-green-600') : (isDark ? 'text-amber-400' : 'text-amber-600')}`}>
                          {isCompleted ? 'Completed' : 'Pending'}
                        </span>
                        <button
                          onClick={() => toggleJobStatus(job)}
                          disabled={toggling}
                          className={`relative w-12 h-6 rounded-full transition-colors duration-300 focus:outline-none disabled:opacity-60 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <motion.div
                            animate={{ x: isCompleted ? 24 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-md"
                          />
                        </button>
                      </div>

                      {/* Generate Invoice Button */}
                      {isCompleted && !hasInvoice && (
                        <button
                          onClick={() => openInvoiceForm(job)}
                          className={`text-xs font-bold px-4 py-2 rounded-xl transition ${
                            isDark 
                              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
                              : 'bg-aqua-500 text-white hover:bg-aqua-600'
                          }`}
                        >
                          📄 Generate Invoice
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* Generated Invoices */}
      {myInvoices.length > 0 && (
        <div>
          <h3 className={`font-bold text-lg mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>Generated Invoices</h3>
          <div className="grid gap-3">
            {myInvoices.map(inv => (
              <div
                key={inv.id}
                onClick={() => setViewInvoice(inv)}
                className={`rounded-2xl p-4 shadow-sm border cursor-pointer transition ${
                  isDark 
                    ? 'bg-dark-card border-white/10 hover:border-cyan-500/30'
                    : 'bg-white border-gray-100 hover:border-aqua-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{inv.customerName}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>📞 {inv.customerPhone}</p>
                    <p className={`text-xs mt-0.5 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{inv.invoiceDate}</p>
                    <div className="flex gap-2 mt-2">
                      <p className={`text-sm font-bold ${isDark ? 'text-cyan-400' : 'text-aqua-600'}`}>Bill: ₹{inv.billAmount.toLocaleString('en-IN')}</p>
                      <p className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>Received: ₹{inv.amountReceived.toLocaleString('en-IN')}</p>
                      {inv.paymentPending > 0 && (
                        <p className={`text-sm font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>Pending: ₹{inv.paymentPending.toLocaleString('en-IN')}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                    }`}>
                      {inv.billNo}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate Invoice Modal */}
      <Modal open={!!selectedJob} onClose={() => setSelectedJob(null)} title="Generate Invoice" size="xl">
        {selectedJob && (
          <form onSubmit={handleGenerate} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Customer Name</label>
                <input type="text" value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Phone Number</label>
                <input type="tel" value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase">Location / Address</label>
              <textarea value={form.customerAddress} onChange={e => setForm(f => ({ ...f, customerAddress: e.target.value }))} required rows={2} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 resize-none" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Service Type</label>
                <input type="text" value={form.serviceType} onChange={e => setForm(f => ({ ...f, serviceType: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Date</label>
                <input type="text" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-gray-500 uppercase">Components Used</label>
                <button type="button" onClick={addComponent} className="text-xs text-aqua-600 font-semibold">+ Add</button>
              </div>
              {form.components.map((comp, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select value={comp.name} onChange={e => updateComponent(i, 'name', e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300">
                    <option value="">Select from stock</option>
                    {myStock.map(s => (
                      <option key={s.id} value={s.productName}>{s.productName} (Available: {(s.assignedQuantity || 0) - (s.usedQuantity || 0)})</option>
                    ))}
                  </select>
                  <input type="number" value={comp.quantity} onChange={e => updateComponent(i, 'quantity', Number(e.target.value))} min={1} placeholder="Qty" className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300" />
                  <input type="number" value={comp.amount} onChange={e => updateComponent(i, 'amount', Number(e.target.value))} placeholder="₹" className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300" />
                  <button type="button" onClick={() => removeComponent(i)} className="text-red-400 text-lg">×</button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Bill Amount (₹)</label>
                <input type="number" value={form.billAmount} onChange={e => setForm(f => ({ ...f, billAmount: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase">Amount Received (₹)</label>
                <input type="number" value={form.amountReceived} onChange={e => setForm(f => ({ ...f, amountReceived: e.target.value }))} required placeholder="Enter 0 if pending" className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
              </div>
            </div>

            {Number(form.billAmount) > 0 && Number(form.amountReceived) >= 0 && (
              <div className="bg-aqua-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span>Components Total:</span>
                  <span className="font-bold">₹{componentsTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Bill Amount:</span>
                  <span className="font-bold">₹{Number(form.billAmount).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Amount Received:</span>
                  <span className="font-bold text-green-600">₹{Number(form.amountReceived).toLocaleString('en-IN')}</span>
                </div>
                {(Number(form.billAmount) - Number(form.amountReceived)) > 0 && (
                  <div className="flex justify-between border-t border-aqua-200 pt-2 mt-2">
                    <span className="font-bold text-red-600">Payment Pending:</span>
                    <span className="text-xl font-black text-red-600">₹{(Number(form.billAmount) - Number(form.amountReceived)).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
              📤 Invoice will be sent to admin. Stock will be auto-reduced. Admin can track pending payments.
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setSelectedJob(null)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
                {saving ? 'Generating...' : '📄 Generate Invoice'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* CONTINUED IN NEXT FILE... */}

      {/* View Invoice Modal with A4 Bill Format */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice Preview - A4 Format" size="xl">
        {viewInvoice && (
          <div className="space-y-4">
            {/* Scrollable A4 Preview Container */}
            <div className="bg-gray-100 p-4 rounded-xl max-h-[70vh] overflow-y-auto">
              {/* A4 Bill Format */}
              <div 
                ref={invoiceRef} 
                className="bg-white mx-auto shadow-lg" 
                style={{ 
                  fontFamily: 'Arial, sans-serif', 
                  width: '210mm', 
                  minHeight: '297mm',
                  padding: '20mm'
                }}
              >
              {/* Header */}
              <div className="text-center mb-6 border-b-2 border-gray-800 pb-4">
                <h1 className="text-3xl font-black text-gray-900 mb-1">FRIENDS AQUA CARE</h1>
                <p className="text-sm text-gray-700 font-semibold">Water Purifier Sales & Service</p>
                <div className="mt-3 text-xs text-gray-600 space-y-0.5">
                  <p>📍 Office Address: Coimbatore, Tamil Nadu</p>
                  <p>📞 Phone Number: +91 9876543210</p>
                  <p>📧 Email: friendsaquacare@gmail.com</p>
                </div>
              </div>

              {/* Title */}
              <div className="text-center mb-6">
                <h2 className="text-xl font-black text-gray-900 border-b border-gray-300 inline-block px-4 pb-1">SERVICE BILL / INVOICE</h2>
              </div>

              {/* Bill Info */}
              <div className="flex justify-between mb-6 text-sm">
                <div><span className="font-bold">Bill No:</span> {viewInvoice.billNo}</div>
                <div><span className="font-bold">Date:</span> {viewInvoice.invoiceDate}</div>
              </div>

              {/* Customer Details */}
              <div className="mb-6 border border-gray-300 rounded p-4">
                <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">CUSTOMER DETAILS</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="font-bold w-40">Customer Name:</span><span>{viewInvoice.customerName}</span></div>
                  <div className="flex"><span className="font-bold w-40">Phone Number:</span><span>{viewInvoice.customerPhone}</span></div>
                  <div className="flex"><span className="font-bold w-40">Location / Address:</span><span>{viewInvoice.customerAddress}</span></div>
                </div>
              </div>

              {/* Service Details */}
              <div className="mb-6 border border-gray-300 rounded p-4">
                <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">SERVICE DETAILS</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex"><span className="font-bold w-40">Service Type:</span><span>{viewInvoice.serviceType}</span></div>
                  <div className="flex"><span className="font-bold w-40">Technician Name:</span><span>{viewInvoice.technicianName}</span></div>
                </div>
              </div>

              {/* Components Used Table */}
              <div className="mb-6">
                <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">COMPONENTS USED</h3>
                <table className="w-full border-collapse border border-gray-300 text-sm">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-300 px-3 py-2 text-left font-bold">S.No</th>
                      <th className="border border-gray-300 px-3 py-2 text-left font-bold">Component Name</th>
                      <th className="border border-gray-300 px-3 py-2 text-center font-bold">Quantity</th>
                      <th className="border border-gray-300 px-3 py-2 text-right font-bold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInvoice.components && viewInvoice.components.length > 0 ? (
                      viewInvoice.components.map((comp, i) => (
                        <tr key={i}>
                          <td className="border border-gray-300 px-3 py-2">{i + 1}</td>
                          <td className="border border-gray-300 px-3 py-2">{comp.name}</td>
                          <td className="border border-gray-300 px-3 py-2 text-center">{comp.quantity}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">₹{comp.amount.toLocaleString('en-IN')}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">No components used</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Payment Details */}
              <div className="mb-6 border border-gray-300 rounded p-4">
                <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">PAYMENT DETAILS</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-bold">Components Cost:</span>
                    <span>₹ {viewInvoice.componentsTotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between border-t-2 border-gray-800 pt-2 mt-2">
                    <span className="font-black text-base">Total Bill Amount:</span>
                    <span className="font-black text-base">₹ {viewInvoice.billAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-bold text-green-700">Amount Received:</span>
                    <span className="font-bold text-green-700">₹ {viewInvoice.amountReceived.toLocaleString('en-IN')}</span>
                  </div>
                  {viewInvoice.paymentPending > 0 && (
                    <div className="flex justify-between bg-red-50 p-2 rounded">
                      <span className="font-black text-red-700">Payment Pending:</span>
                      <span className="font-black text-red-700">₹ {viewInvoice.paymentPending.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between mt-12 pt-8 border-t border-gray-300">
                <div className="text-center">
                  <div className="border-t border-gray-800 w-40 mb-1"></div>
                  <p className="text-xs font-bold">Customer Signature</p>
                </div>
                <div className="text-center">
                  <div className="border-t border-gray-800 w-40 mb-1"></div>
                  <p className="text-xs font-bold">Technician Signature</p>
                </div>
              </div>

              {/* Footer */}
              <div className="text-center mt-8 pt-4 border-t-2 border-gray-800">
                <p className="text-sm font-bold text-gray-900">Thank you for choosing FRIENDS AQUA CARE</p>
              </div>
            </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={downloadPDF}
                className="bg-aqua-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-aqua-600 transition flex items-center justify-center gap-2"
              >
                📥 Download PDF
              </button>
              <button
                onClick={shareWhatsApp}
                className="bg-green-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2"
              >
                📱 Download & Share WhatsApp
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
