import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const STATUS_COLORS = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700' }

export default function Invoices() {
  const [invoices, setInvoices] = useState([])
  const [jobs, setJobs] = useState([])
  const [products, setProducts] = useState([])
  const [modal, setModal] = useState(false)
  const [viewInvoice, setViewInvoice] = useState(null)
  const [form, setForm] = useState({ jobId: '', serviceCharge: '', warrantyMonths: '3', items: [] })
  const [saving, setSaving] = useState(false)
  const invoiceRef = useRef(null)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'invoices'), snap => setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0))))
    const u2 = onSnapshot(collection(db, 'service_jobs'), snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    const u3 = onSnapshot(collection(db, 'products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
    return () => { u1(); u2(); u3() }
  }, [])

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { productId: '', productName: '', quantity: 1, unitPrice: 0 }] }))
  const removeItem = (i) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }))
  const updateItem = (i, key, val) => setForm(f => {
    const items = [...f.items]
    items[i] = { ...items[i], [key]: val }
    if (key === 'productId') {
      const p = products.find(p => p.id === val)
      if (p) { items[i].productName = p.name; items[i].unitPrice = p.price }
    }
    return { ...f, items }
  })

  const total = form.items.reduce((s, i) => s + (i.quantity * i.unitPrice), 0) + Number(form.serviceCharge || 0)

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const job = jobs.find(j => j.id === form.jobId)
      await addDoc(collection(db, 'invoices'), {
        jobId: form.jobId,
        customerId: job?.customerId || '',
        customerName: job?.customerName || '',
        customerPhone: job?.customerPhone || '',
        items: form.items,
        serviceCharge: Number(form.serviceCharge),
        totalAmount: total,
        warrantyMonths: Number(form.warrantyMonths),
        paymentStatus: 'pending',
        generatedDate: serverTimestamp(),
      })
      toast.success('Invoice created')
      setModal(false)
      setForm({ jobId: '', serviceCharge: '', warrantyMonths: '3', items: [] })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const downloadPDF = async () => {
    if (!invoiceRef.current) return
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`invoice-${viewInvoice.id}.pdf`)
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Invoices</h2>
        <button onClick={() => setModal(true)} className="bg-aqua-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-aqua-600 transition">
          + Create Invoice
        </button>
      </div>

      <div className="grid gap-3">
        {invoices.map(inv => (
          <div key={inv.id} onClick={() => setViewInvoice(inv)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-aqua-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800">{inv.customerName || 'Customer'}</p>
                <p className="text-xs text-gray-500 mt-0.5">{inv.customerPhone}</p>
                <p className="text-lg font-black text-aqua-600 mt-1">₹{Number(inv.totalAmount).toLocaleString('en-IN')}</p>
              </div>
              <div className="text-right">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[inv.paymentStatus] || 'bg-gray-100 text-gray-600'}`}>
                  {inv.paymentStatus}
                </span>
                <p className="text-xs text-gray-400 mt-2">{inv.warrantyMonths}m warranty</p>
              </div>
            </div>
          </div>
        ))}
        {invoices.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No invoices yet</p>}
      </div>

      {/* Create Invoice Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Invoice" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Job</label>
            <select value={form.jobId} onChange={e => setForm(f => ({ ...f, jobId: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300">
              <option value="">Select job</option>
              {jobs.filter(j => j.status === 'completed').map(j => <option key={j.id} value={j.id}>{j.customerName} — {j.problemDescription}</option>)}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products Used</label>
              <button type="button" onClick={addItem} className="text-xs text-aqua-600 font-semibold">+ Add Item</button>
            </div>
            {form.items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select value={item.productId} onChange={e => updateItem(i, 'productId', e.target.value)} className="flex-1 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300">
                  <option value="">Select product</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', Number(e.target.value))} min={1} className="w-16 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300" placeholder="Qty" />
                <input type="number" value={item.unitPrice} onChange={e => updateItem(i, 'unitPrice', Number(e.target.value))} className="w-20 border border-gray-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-aqua-300" placeholder="Price" />
                <button type="button" onClick={() => removeItem(i)} className="text-red-400 text-lg">×</button>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Charge (₹)</label>
              <input type="number" value={form.serviceCharge} onChange={e => setForm(f => ({ ...f, serviceCharge: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Warranty (months)</label>
              <input type="number" value={form.warrantyMonths} onChange={e => setForm(f => ({ ...f, warrantyMonths: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
            </div>
          </div>

          <div className="bg-aqua-50 rounded-xl p-3 text-right">
            <p className="text-sm text-gray-600">Total: <span className="text-xl font-black text-aqua-700">₹{total.toLocaleString('en-IN')}</span></p>
          </div>

          <div className="flex gap-3">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal open={!!viewInvoice} onClose={() => setViewInvoice(null)} title="Invoice" size="lg">
        {viewInvoice && (
          <div className="space-y-4">
            <div ref={invoiceRef} className="bg-white p-4 rounded-xl border border-gray-100">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-aqua-700">💧 Friends Aqua Care</h2>
                <p className="text-xs text-gray-500">RO Water Purifier Service</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div><p className="text-gray-500 text-xs">Customer</p><p className="font-semibold">{viewInvoice.customerName}</p></div>
                <div><p className="text-gray-500 text-xs">Phone</p><p className="font-semibold">{viewInvoice.customerPhone}</p></div>
                <div><p className="text-gray-500 text-xs">Warranty</p><p className="font-semibold">{viewInvoice.warrantyMonths} months</p></div>
                <div><p className="text-gray-500 text-xs">Status</p><p className="font-semibold capitalize">{viewInvoice.paymentStatus}</p></div>
              </div>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-1 text-xs text-gray-500">Item</th><th className="text-center py-1 text-xs text-gray-500">Qty</th><th className="text-right py-1 text-xs text-gray-500">Amount</th></tr></thead>
                <tbody>
                  {(viewInvoice.items || []).map((item, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5">{item.productName}</td>
                      <td className="text-center py-1.5">{item.quantity}</td>
                      <td className="text-right py-1.5">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr><td className="py-1.5 text-gray-500">Service Charge</td><td></td><td className="text-right py-1.5">₹{Number(viewInvoice.serviceCharge).toLocaleString('en-IN')}</td></tr>
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-200"><td colSpan={2} className="py-2 font-black">Total</td><td className="text-right py-2 font-black text-aqua-700">₹{Number(viewInvoice.totalAmount).toLocaleString('en-IN')}</td></tr></tfoot>
              </table>
            </div>
            <button onClick={downloadPDF} className="w-full bg-aqua-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-aqua-600 transition">
              📥 Download PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
