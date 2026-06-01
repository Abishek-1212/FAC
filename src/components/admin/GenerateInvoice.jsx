import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc as fsDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export default function GenerateInvoice() {
  const { isDark } = useTheme()
  const [categories, setCategories] = useState([])
  const [invProducts, setInvProducts] = useState([])
  const [form, setForm] = useState({ category: '', productId: '', quantity: '', companyName: '', billAmount: '' })
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'product_categories'), snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    })
    const u2 = onSnapshot(collection(db, 'inventory'), snap => {
      setInvProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { u1(); u2() }
  }, [])

  const filteredProducts = invProducts.filter(p => p.category === form.category)
  const selectedProduct = invProducts.find(p => p.id === form.productId)

  const handlePreview = () => {
    const qty = Number(form.quantity)
    const stock = selectedProduct?.quantity || 0
    if (qty > stock) {
      toast.error(`Only ${stock} units available in stock`)
      return
    }
    setShowPreview(true)
  }

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const qty = Number(form.quantity)
      const billAmt = Number(form.billAmount)
      const invoiceNo = `FAC-SALE-${Date.now()}`
      const dateStr = new Date().toLocaleDateString('en-IN')
      const productName = selectedProduct?.productName || selectedProduct?.name || ''

      const doc = new jsPDF('p', 'mm', 'a4')
      const pw = doc.internal.pageSize.getWidth()
      const ph = doc.internal.pageSize.getHeight()
      const m = 12
      const cyan = [6, 182, 212]
      const dark = [31, 41, 55]
      const muted = [107, 114, 128]

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.setTextColor(...cyan)
      doc.text('Friends Aqua Care', m, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...muted)
      doc.text('Water Purifier Service & Maintenance', m, 26)
      doc.text('GSTIN: 33ACDPU6542L1Z9  |  Phone: +91 99765 55199  |  Email: facwatersystems@gmail.com', m, 31)

      doc.setDrawColor(...cyan)
      doc.setLineWidth(0.6)
      doc.line(m, 35, pw - m, 35)

      doc.setFont('helvetica', 'bold')
      doc.setFontSize(14)
      doc.setTextColor(...dark)
      doc.text('SALES INVOICE', pw / 2, 43, { align: 'center' })

      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...dark)
      doc.text(`Invoice No: ${invoiceNo}`, m, 52)
      doc.text(`Date: ${dateStr}`, pw - m, 52, { align: 'right' })

      doc.setDrawColor(209, 213, 219)
      doc.setLineWidth(0.2)
      doc.rect(m, 56, pw - m * 2, 18)
      doc.setFillColor(...cyan)
      doc.rect(m, 56, pw - m * 2, 5, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(255, 255, 255)
      doc.text('BILL TO', m + 3, 59.5)
      doc.setTextColor(...dark)
      doc.setFontSize(10)
      doc.text(form.companyName, m + 3, 67)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...muted)
      doc.text('Company / Customer', m + 3, 71)

      autoTable(doc, {
        startY: 80,
        head: [['S.No', 'Category', 'Product Name', 'Quantity', 'Amount (₹)']],
        body: [['1', form.category, productName, qty.toString(), `Rs. ${billAmt.toLocaleString('en-IN')}`]],
        theme: 'grid',
        headStyles: { fillColor: cyan, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9, halign: 'center', cellPadding: 4 },
        bodyStyles: { fontSize: 9, textColor: dark, cellPadding: 4, halign: 'center' },
        columnStyles: { 2: { halign: 'left' } },
        margin: { left: m, right: m },
      })

      const tableEndY = doc.lastAutoTable.finalY + 8
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...cyan)
      doc.text(`TOTAL: Rs. ${billAmt.toLocaleString('en-IN')}`, pw - m, tableEndY, { align: 'right' })

      const sigY = ph - 32
      doc.setDrawColor(209, 213, 219)
      doc.setLineWidth(0.2)
      doc.line(m, sigY, m + 45, sigY)
      doc.line(pw - m - 45, sigY, pw - m, sigY)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7.5)
      doc.setTextColor(...dark)
      doc.text('Customer Signature', m, sigY + 4)
      doc.setFont('helvetica', 'bold')
      doc.text('Authorized Signature', pw - m - 44, sigY + 4)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(7)
      doc.text('For Friends Aqua Care', pw - m - 44, sigY + 8)

      doc.setFillColor(...cyan)
      doc.rect(0, ph - 12, pw, 12, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(255, 255, 255)
      doc.text('Thank you for choosing Friends Aqua Care  |  +91 99765 55199', pw / 2, ph - 4, { align: 'center' })

      doc.save(`${invoiceNo}.pdf`)

      await updateDoc(fsDoc(db, 'inventory', form.productId), {
        quantity: (selectedProduct.quantity || 0) - qty,
        lastUpdated: serverTimestamp(),
      })

      await addDoc(collection(db, 'invoices'), {
        invoiceNumber: invoiceNo,
        type: 'sale',
        companyName: form.companyName,
        category: form.category,
        productName,
        quantity: qty,
        billAmount: billAmt,
        createdAt: serverTimestamp(),
      })

      toast.success('✅ Invoice generated & stock updated')
      setShowPreview(false)
      setForm({ category: '', productId: '', quantity: '', companyName: '', billAmount: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'
  const cardBase = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`
  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 ${isDark ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`
  const labelCls = `text-xs font-bold block mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`

  const allFilled = form.category && form.productId && form.quantity && form.companyName && form.billAmount

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h2 className={`text-2xl font-black ${t}`}>Generate Invoice</h2>
        <p className={`text-sm mt-1 ${s}`}>Fill in the details to create a sales invoice</p>
      </div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`${cardBase} p-6 space-y-5`}
      >
        {/* Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value, productId: '' }))}
              className={inputCls}
            >
              <option value="">Select category</option>
              {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Product Name</label>
            <select
              value={form.productId}
              onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              disabled={!form.category}
              className={inputCls}
            >
              <option value="">Select product</option>
              {filteredProducts.map(p => (
                <option key={p.id} value={p.id}>{p.productName || p.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              Quantity
              {selectedProduct && (
                <span className={`ml-2 font-normal ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>
                  (Available: {selectedProduct.quantity || 0})
                </span>
              )}
            </label>
            <input
              type="number" min="1"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              placeholder="Enter quantity"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Company Name</label>
            <input
              type="text"
              value={form.companyName}
              onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
              placeholder="Enter company / customer name"
              className={inputCls}
            />
          </div>
        </div>

        {/* Row 3 */}
        <div>
          <label className={labelCls}>Bill Amount (₹)</label>
          <input
            type="number" min="0"
            value={form.billAmount}
            onChange={e => setForm(f => ({ ...f, billAmount: e.target.value }))}
            placeholder="Enter total bill amount"
            className={inputCls}
          />
        </div>

        {/* Selected product info pill */}
        {selectedProduct && (
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${isDark ? 'bg-cyan-500/10 border border-cyan-500/20' : 'bg-cyan-50 border border-cyan-100'}`}>
            <span className="text-lg">📦</span>
            <div>
              <p className={`text-xs font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>{selectedProduct.productName || selectedProduct.name}</p>
              <p className={`text-xs ${isDark ? 'text-cyan-400/70' : 'text-cyan-600/70'}`}>{form.category} · Stock: {selectedProduct.quantity || 0} units</p>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handlePreview}
          disabled={!allFilled}
          className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          🧾 Preview & Generate Invoice
        </button>
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60" onClick={() => setShowPreview(false)} />
            <motion.div
              className={`relative w-full max-w-md rounded-2xl shadow-2xl ${isDark ? 'bg-gray-800 border border-white/10' : 'bg-white'}`}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className={`px-6 py-4 border-b flex items-center justify-between ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                <h3 className={`text-base font-black ${t}`}>Invoice Preview</h3>
                <button onClick={() => setShowPreview(false)} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>✕</button>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className={`rounded-xl p-4 space-y-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                  {[
                    ['Company', form.companyName],
                    ['Category', form.category],
                    ['Product', selectedProduct?.productName || selectedProduct?.name || ''],
                    ['Quantity', form.quantity],
                    ['Bill Amount', `₹${Number(form.billAmount).toLocaleString('en-IN')}`],
                    ['Date', new Date().toLocaleDateString('en-IN')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className={`text-xs font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{label}</span>
                      <span className={`text-sm font-bold ${t}`}>{value}</span>
                    </div>
                  ))}
                </div>
                <p className={`text-xs text-center ${s}`}>
                  Download will generate the PDF and deduct {form.quantity} unit(s) from inventory.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPreview(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={generating}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-60"
                  >
                    {generating ? 'Generating...' : '⬇️ Download PDF'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
