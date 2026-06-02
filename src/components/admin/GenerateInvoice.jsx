import { useEffect, useState, useMemo } from 'react'
import { collection, onSnapshot, doc as fsDoc, updateDoc, serverTimestamp, addDoc, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

const EMPTY_ITEM = { category: '', productId: '', quantity: '' }

const ordinalSuffix = (d) => {
  const s = ['th','st','nd','rd'], v = d % 100
  return d + (s[(v - 20) % 10] || s[v] || s[0])
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const fmtRangeLabel = (from, to) => {
  const f = new Date(from), t = new Date(to)
  return `${ordinalSuffix(f.getDate())} ${MONTH_NAMES[f.getMonth()]} to ${ordinalSuffix(t.getDate())} ${MONTH_NAMES[t.getMonth()]}`
}

export default function GenerateInvoice() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [invProducts, setInvProducts] = useState([])
  const [invoices, setInvoices] = useState([])

  // Customer info
  const [customer, setCustomer] = useState({ companyName: '', phone: '', paymentMode: 'Cash', billAmount: '' })
  const [discount, setDiscount] = useState({ type: 'percentage', value: '' })

  // Products list
  const [items, setItems] = useState([])           // confirmed items
  const [editIndex, setEditIndex] = useState(null)  // index being edited (null = adding new)
  const [draft, setDraft] = useState(EMPTY_ITEM)    // current add/edit row

  const [showForm, setShowForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Filter state
  const [activeFilter, setActiveFilter] = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [showCustomInputs, setShowCustomInputs] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [downloadingId, setDownloadingId] = useState(null)

  // Computed discount
  const billAmt = Number(customer.billAmount) || 0
  const discountVal = Number(discount.value) || 0
  const discountAmount = discount.type === 'percentage'
    ? Math.round((billAmt * discountVal) / 100 * 100) / 100
    : discountVal
  const grandTotal = Math.max(0, billAmt - discountAmount)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'product_categories'), snap => {
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.name.localeCompare(b.name)))
    })
    const u2 = onSnapshot(collection(db, 'inventory'), snap => {
      setInvProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    const u3 = onSnapshot(query(collection(db, 'invoices'), where('type', '==', 'sale')), snap => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { u1(); u2(); u3() }
  }, [])

  const filteredInvoices = useMemo(() => {
    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let from, to
    if (activeFilter === 'today') {
      from = startOfDay; to = new Date(startOfDay.getTime() + 86400000)
    } else if (activeFilter === 'week') {
      const day = now.getDay()
      from = new Date(startOfDay.getTime() - day * 86400000)
      to = new Date(from.getTime() + 7 * 86400000)
    } else if (activeFilter === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1)
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    } else if (activeFilter === 'custom' && customFrom && customTo) {
      const [fy, fm, fd] = customFrom.split('-').map(Number)
      const [ty, tm, td] = customTo.split('-').map(Number)
      from = new Date(fy, fm - 1, fd)
      to = new Date(ty, tm - 1, td + 1)
    } else {
      return invoices
    }
    return invoices.filter(inv => {
      const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)
      return d >= from && d < to
    }).sort((a, b) => {
      const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt)
      const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt)
      return db2 - da
    })
  }, [invoices, activeFilter, customFrom, customTo])

  const getProduct = (id) => invProducts.find(p => p.id === id)

  // Products in selected category, excluding already-added ones (except the one being edited)
  const availableProducts = invProducts.filter(p => {
    if (p.category !== draft.category) return false
    const alreadyAdded = items.some((item, idx) => item.productId === p.id && idx !== editIndex)
    return !alreadyAdded
  })

  const draftProduct = getProduct(draft.productId)

  const draftValid = draft.category && draft.productId && Number(draft.quantity) > 0

  const addOrUpdateItem = () => {
    if (!draftValid) return
    const qty = Number(draft.quantity)
    const stock = draftProduct?.quantity || 0
    if (qty > stock) { toast.error(`Only ${stock} units available`); return }

    const newItem = {
      category: draft.category,
      productId: draft.productId,
      productName: draftProduct?.productName || draftProduct?.name || '',
      quantity: qty,
    }

    if (editIndex !== null) {
      setItems(prev => prev.map((it, i) => i === editIndex ? newItem : it))
      setEditIndex(null)
    } else {
      setItems(prev => [...prev, newItem])
    }
    setDraft(EMPTY_ITEM)
  }

  const startEdit = (idx) => {
    const it = items[idx]
    setDraft({ category: it.category, productId: it.productId, quantity: String(it.quantity) })
    setEditIndex(idx)
  }

  const cancelEdit = () => { setDraft(EMPTY_ITEM); setEditIndex(null) }

  const removeItem = (idx) => {
    setItems(prev => prev.filter((_, i) => i !== idx))
    if (editIndex === idx) cancelEdit()
  }

  const customerValid = customer.companyName && customer.phone && customer.billAmount && items.length > 0

  const handleDownload = async () => {
    setGenerating(true)
    try {
      const invoiceNo = `FAC-SALE-${Date.now()}`

      generateInvoice({
        invoiceNumber: invoiceNo,
        customerName: customer.companyName,
        customerPhone: customer.phone,
        paymentMode: customer.paymentMode,
        totalAmount: billAmt,
        discountType: discount.type,
        discountValue: discountVal,
        discountAmount,
        grandTotal,
        amountReceived: grandTotal,
        serviceDate: new Date(),
        isSalesInvoice: true,
        products: items.map(it => ({ name: it.productName, qty: it.quantity, category: it.category })),
      })

      for (const it of items) {
        const prod = getProduct(it.productId)
        if (prod) {
          await updateDoc(fsDoc(db, 'inventory', it.productId), {
            quantity: (prod.quantity || 0) - it.quantity,
            lastUpdated: serverTimestamp(),
          })
        }
      }

      await addDoc(collection(db, 'invoices'), {
        invoiceNumber: invoiceNo,
        type: 'sale',
        companyName: customer.companyName,
        phone: customer.phone,
        paymentMode: customer.paymentMode,
        billAmount: billAmt,
        discountType: discountVal > 0 ? discount.type : null,
        discountValue: discountVal > 0 ? discountVal : null,
        discountAmount: discountVal > 0 ? discountAmount : null,
        grandTotal,
        products: items.map(it => ({ category: it.category, productName: it.productName, quantity: it.quantity })),
        createdAt: serverTimestamp(),
      })

      toast.success('✅ Invoice generated & stock updated')
      setShowPreview(false)
      setItems([])
      setCustomer({ companyName: '', phone: '', paymentMode: 'Cash', billAmount: '' })
      setDiscount({ type: 'percentage', value: '' })
      setDraft(EMPTY_ITEM)
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

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* Pill Header */}
      <div className="flex justify-center pt-1">
        <div className={`relative flex items-center justify-center w-full max-w-sm h-12 rounded-full border shadow-sm ${
          isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-gray-100'
        }`}>
          {/* Back button — left */}
          <button
            onClick={() => navigate('/admin')}
            className={`absolute left-1.5 w-9 h-9 rounded-full flex items-center justify-center transition ${
              isDark ? 'bg-white/10 text-white/70 hover:bg-white/20 hover:text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
            }`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {/* Title — centered */}
          <span className={`text-base font-black tracking-widest uppercase ${t}`}>Generate Invoice</span>
        </div>
      </div>

      {/* Generate New Invoice Button */}
      <motion.button
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        onClick={() => setShowForm(v => !v)}
        className={`w-full py-3.5 rounded-2xl border-2 border-dashed font-bold text-sm transition flex items-center justify-center gap-2 ${
          showForm
            ? isDark ? 'border-orange-500/50 bg-orange-500/10 text-orange-300' : 'border-orange-400 bg-orange-50 text-orange-600'
            : isDark ? 'border-white/20 bg-white/5 text-white/60 hover:border-orange-500/40 hover:text-orange-300' : 'border-gray-300 bg-white text-gray-500 hover:border-orange-400 hover:text-orange-500'
        }`}>
        <span className={`text-lg transition-transform duration-300 ${showForm ? 'rotate-45' : ''}`}>+</span>
        {showForm ? 'Close Form' : 'Generate New Invoice'}
      </motion.button>

      {/* Invoice Form Card */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            key="invoice-form"
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className={`${cardBase} p-6 space-y-6`}>

            {/* Customer Info */}
            <div className="space-y-4">
              <p className={`text-xs font-bold uppercase tracking-wider ${s}`}>Customer Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Company / Customer Name</label>
            <input type="text" value={customer.companyName}
              onChange={e => setCustomer(c => ({ ...c, companyName: e.target.value }))}
              placeholder="Enter name" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Phone Number</label>
            <input type="tel" value={customer.phone}
              onChange={e => setCustomer(c => ({ ...c, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
              placeholder="Enter phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Payment Mode</label>
            <select value={customer.paymentMode} onChange={e => setCustomer(c => ({ ...c, paymentMode: e.target.value }))} className={inputCls}>
              {['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Bill Amount (₹)</label>
            <input type="number" min="0" value={customer.billAmount}
              onChange={e => setCustomer(c => ({ ...c, billAmount: e.target.value }))}
              onWheel={e => e.target.blur()}
              placeholder="Enter total bill amount" className={inputCls} />
          </div>
          {/* Discount — optional */}
              <div className="md:col-span-2">
                <label className={labelCls}>Discount <span className={`font-normal ${s}`}>(optional)</span></label>
                <div className="flex gap-2">
                  <div className={`flex rounded-xl border overflow-hidden text-sm font-bold ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                    <button type="button"
                      onClick={() => setDiscount(d => ({ ...d, type: 'percentage' }))}
                      className={`px-4 py-3 transition ${
                        discount.type === 'percentage'
                          ? 'bg-orange-500 text-white'
                          : isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}>%</button>
                    <button type="button"
                      onClick={() => setDiscount(d => ({ ...d, type: 'amount' }))}
                      className={`px-4 py-3 transition ${
                        discount.type === 'amount'
                          ? 'bg-orange-500 text-white'
                          : isDark ? 'bg-white/5 text-white/50 hover:bg-white/10' : 'bg-white text-gray-500 hover:bg-gray-50'
                      }`}>₹</button>
                  </div>
                  <input type="number" min="0" value={discount.value}
                    onChange={e => setDiscount(d => ({ ...d, value: e.target.value }))}
                    onWheel={e => e.target.blur()}
                    placeholder={discount.type === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 40 for ₹40 off'}
                    className={`flex-1 ${inputCls}`} />
                  {discount.value && (
                    <div className={`flex items-center px-3 rounded-xl text-sm font-bold whitespace-nowrap ${
                      isDark ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-green-50 text-green-600 border border-green-200'
                    }`}>
                      −₹{discountAmount.toLocaleString('en-IN')}
                    </div>
                  )}
                </div>
                {discount.value && (
                  <p className={`text-xs mt-1.5 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                    Grand Total: ₹{grandTotal.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>
            </div>

            {/* Products Section */}
            <div className="space-y-4">
              <p className={`text-xs font-bold uppercase tracking-wider ${s}`}>Products</p>

        {/* Added Items List */}
        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((it, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                onClick={() => editIndex !== idx && startEdit(idx)}
                className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition ${
                  editIndex === idx
                    ? isDark ? 'bg-orange-500/10 border-orange-500/50' : 'bg-orange-50 border-orange-300'
                    : isDark ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>{idx + 1}</span>
                  <div>
                    <p className={`text-sm font-bold ${t}`}>{it.productName}</p>
                    <p className={`text-xs ${s}`}>{it.category} · Qty: {it.quantity}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editIndex === idx && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-100 text-orange-600'}`}>Editing</span>
                  )}
                  <button onClick={e => { e.stopPropagation(); removeItem(idx) }}
                    className="text-red-400 hover:text-red-600 transition p-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Add / Edit Row */}
        <div className={`rounded-xl border p-4 space-y-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`text-xs font-bold ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>
            {editIndex !== null ? `Editing Product #${editIndex + 1}` : '+ Add Product'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Category</label>
              <select value={draft.category}
                onChange={e => setDraft(d => ({ ...d, category: e.target.value, productId: '' }))}
                className={inputCls}>
                <option value="">Select category</option>
                {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Product</label>
              <select value={draft.productId}
                onChange={e => setDraft(d => ({ ...d, productId: e.target.value }))}
                disabled={!draft.category}
                className={inputCls}>
                <option value="">Select product</option>
                {availableProducts.map(p => (
                  <option key={p.id} value={p.id}>{p.productName || p.name} ({p.quantity || 0} avail.)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Quantity
                {draftProduct && <span className={`ml-1 font-normal ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>(Max: {draftProduct.quantity || 0})</span>}
              </label>
              <input type="number" min="1" value={draft.quantity}
                onChange={e => setDraft(d => ({ ...d, quantity: e.target.value }))}
                onWheel={e => e.target.blur()}
                placeholder="Qty" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={addOrUpdateItem} disabled={!draftValid}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-40">
              {editIndex !== null ? '✓ Update Product' : '+ Add to List'}
            </button>
            {editIndex !== null && (
              <button onClick={cancelEdit}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'}`}>
                Cancel
              </button>
            )}
          </div>
        </div>

              {/* Generate Button */}
              <button onClick={() => setShowPreview(true)} disabled={!customerValid}
                className="w-full py-3.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                Preview & Generate Invoice
              </button>
            </div>

          </motion.div>
        )}
      </AnimatePresence>

      {/* Invoice History */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={`${cardBase} p-6 space-y-4`}>
        <p className={`text-xs font-bold uppercase tracking-wider ${s}`}>Invoice History</p>

        {/* Filter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {[
            ['today',  'Today'],
            ['week',   'This Week'],
            ['month',  'This Month'],
            ['custom', 'Custom Range'],
          ].map(([key, label]) => (
            <button key={key}
              onClick={() => { setActiveFilter(key); if (key === 'custom') setShowCustomInputs(true) }}
              className={`flex-shrink-0 inline-flex items-center px-4 py-2 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap border ${
                activeFilter === key
                  ? 'bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-500/25'
                  : isDark
                    ? 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white hover:border-white/20'
                    : 'bg-white text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 shadow-sm'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {activeFilter === 'custom' && showCustomInputs && (
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className={labelCls}>From</label>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>To</label>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className={inputCls} />
            </div>
          </div>
        )}

        {/* Date Range Chip */}
        {activeFilter === 'custom' && customFrom && customTo && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
            isDark ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'bg-orange-50 text-orange-600 border border-orange-200'
          }`}>
            {fmtRangeLabel(customFrom, customTo)}
            <button onClick={() => { setCustomFrom(''); setCustomTo('') }}
              className={`ml-1 w-4 h-4 rounded-full flex items-center justify-center text-xs transition ${
                isDark ? 'bg-orange-500/30 hover:bg-orange-500/50' : 'bg-orange-200 hover:bg-orange-300'
              }`}>✕</button>
          </div>
        )}

        {/* Invoice List */}
        {filteredInvoices.length === 0 ? (
          <p className={`text-sm text-center py-6 ${s}`}>No invoices found for this period.</p>
        ) : (() => {
            // Group by date label
            const groups = []
            const seen = {}
            filteredInvoices.forEach(inv => {
              const d = inv.createdAt?.toDate ? inv.createdAt.toDate() : new Date(inv.createdAt)
              const today = new Date()
              const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
              const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
              const label = isSameDay(d, today) ? 'Today' : isSameDay(d, yesterday) ? 'Yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
              if (!seen[label]) { seen[label] = true; groups.push({ label, items: [] }) }
              groups[groups.length - 1].items.push({ inv, d })
            })
            return (
              <div className="space-y-4">
                {groups.map(({ label, items }) => (
                  <div key={label}>
                    {/* Sticky date header */}
                    <div className={`sticky top-0 z-10 flex items-center gap-3 py-2 ${
                      isDark ? 'bg-white/5' : 'bg-white'
                    }`} style={{ backdropFilter: 'blur(8px)' }}>
                      <span className={`text-[11px] font-black uppercase tracking-widest ${
                        isDark ? 'text-orange-300/80' : 'text-orange-500'
                      }`}>{label}</span>
                      <div className={`flex-1 h-px ${isDark ? 'bg-white/10' : 'bg-orange-100'}`} />
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        isDark ? 'bg-white/10 text-white/40' : 'bg-orange-50 text-orange-400'
                      }`}>{items.length} invoice{items.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="space-y-2 mt-1">
                      {items.map(({ inv, d }) => {
                        const isOpen = expandedId === inv.id
                        const total = inv.grandTotal ?? inv.billAmount ?? 0
                        return (
                          <motion.div key={inv.id} layout
                            className={`rounded-xl border overflow-hidden transition-shadow ${
                              isOpen
                                ? isDark ? 'border-orange-500/40 shadow-lg shadow-orange-500/10' : 'border-orange-300 shadow-md shadow-orange-100'
                                : isDark ? 'border-white/10' : 'border-gray-200'
                            }`}>
                            {/* Row header — always visible */}
                            <button onClick={() => setExpandedId(isOpen ? null : inv.id)}
                              className={`w-full flex items-center justify-between px-4 py-3 text-left transition ${
                                isOpen
                                  ? isDark ? 'bg-orange-500/10' : 'bg-orange-50'
                                  : isDark ? 'bg-white/5 hover:bg-white/8' : 'bg-gray-50 hover:bg-gray-100'
                              }`}>
                              <div className="flex items-center gap-3">
                                <div>
                                  <p className={`text-sm font-bold leading-tight ${t}`}>{inv.companyName}</p>
                                  <p className={`text-xs mt-0.5 ${s}`}>{inv.invoiceNumber}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className={`text-sm font-black ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>
                                    ₹{total.toLocaleString('en-IN')}
                                  </p>
                                </div>
                              </div>
                            </button>

                            {/* Expanded detail panel */}
                            <AnimatePresence initial={false}>
                              {isOpen && (
                                <motion.div
                                  key="detail"
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                                  className="overflow-hidden">
                                  <div className={`px-4 pb-4 pt-3 space-y-3 border-t ${
                                    isDark ? 'border-white/10' : 'border-orange-100'
                                  }`}>
                                    {/* Info grid */}
                                    <div className="grid grid-cols-2 gap-2">
                                      {[
                                        ['Phone', inv.phone || '—'],
                                        ['Payment', inv.paymentMode],
                                        ['Bill Amount', `₹${(inv.billAmount ?? 0).toLocaleString('en-IN')}`],
                                        ['Time', d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })],
                                        ...(inv.discountAmount > 0 ? [['Discount', `−₹${inv.discountAmount.toLocaleString('en-IN')}`]] : []),
                                        ...(inv.discountAmount > 0 ? [['Grand Total', `₹${(inv.grandTotal ?? 0).toLocaleString('en-IN')}`]] : []),
                                      ].map(([label, value]) => (
                                        <div key={label} className={`rounded-lg px-3 py-2 ${
                                          isDark ? 'bg-white/5' : 'bg-gray-50'
                                        }`}>
                                          <p className={`text-[10px] font-semibold mb-0.5 ${s}`}>{label}</p>
                                          <p className={`text-xs font-bold ${t}`}>{value}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {/* Products */}
                                    {inv.products?.length > 0 && (
                                      <div className={`rounded-lg p-3 ${
                                        isDark ? 'bg-white/5' : 'bg-gray-50'
                                      }`}>
                                        <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${
                                          isDark ? 'text-white/40' : 'text-gray-400'
                                        }`}>Products ({inv.products.length})</p>
                                        <div className="space-y-1">
                                          {inv.products.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center">
                                              <span className={`text-xs ${isDark ? 'text-white/70' : 'text-gray-700'}`}>
                                                {i + 1}. {p.productName}
                                                <span className={`ml-1 text-[10px] ${s}`}>({p.category})</span>
                                              </span>
                                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                                                isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                                              }`}>×{p.quantity}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {/* Download button */}
                                    <button
                                      disabled={downloadingId === inv.id}
                                      onClick={() => {
                                        setDownloadingId(inv.id)
                                        try {
                                          generateInvoice({
                                            invoiceNumber: inv.invoiceNumber,
                                            customerName: inv.companyName,
                                            customerPhone: inv.phone,
                                            paymentMode: inv.paymentMode,
                                            totalAmount: inv.billAmount ?? 0,
                                            discountType: inv.discountType || 'percentage',
                                            discountValue: inv.discountValue || 0,
                                            discountAmount: inv.discountAmount || 0,
                                            grandTotal: inv.grandTotal ?? inv.billAmount ?? 0,
                                            amountReceived: inv.grandTotal ?? inv.billAmount ?? 0,
                                            serviceDate: d,
                                            isSalesInvoice: true,
                                            products: (inv.products || []).map(p => ({ name: p.productName, qty: p.quantity, category: p.category })),
                                          })
                                        } finally {
                                          setDownloadingId(null)
                                        }
                                      }}
                                      className={`w-full py-2.5 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${
                                        downloadingId === inv.id
                                          ? 'opacity-60 cursor-not-allowed bg-orange-500 text-white'
                                          : 'bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-500/30'
                                      }`}>
                                      {downloadingId === inv.id ? 'Generating…' : 'Download Invoice PDF'}
                                    </button>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
      </motion.div>

      {/* Preview Modal */}
      <AnimatePresence>
        {showPreview && (
          <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="absolute inset-0 bg-black/60" onClick={() => setShowPreview(false)} />
            <motion.div
              className={`relative w-full max-w-md rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto ${isDark ? 'bg-gray-800 border border-white/10' : 'bg-white'}`}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
              <div className={`px-6 py-4 border-b flex items-center justify-between sticky top-0 ${isDark ? 'bg-gray-800 border-white/10' : 'bg-white border-gray-200'}`}>
                <h3 className={`text-base font-black ${t}`}>Invoice Preview</h3>
                <button onClick={() => setShowPreview(false)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm transition ${isDark ? 'bg-white/10 text-white/60 hover:bg-white/20' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>✕</button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {/* Customer summary */}
                <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                  {[
                    ['Company / Customer', customer.companyName],
                    ['Phone', customer.phone],
                    ['Payment', customer.paymentMode],
                    ['Bill Amount', `₹${billAmt.toLocaleString('en-IN')}`],
                    ['Date', new Date().toLocaleDateString('en-IN')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className={`text-xs font-semibold ${s}`}>{label}</span>
                      <span className={`text-sm font-bold ${t}`}>{value}</span>
                    </div>
                  ))}
                  {discountVal > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className={`text-xs font-semibold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          Discount {discount.type === 'percentage' ? `(${discountVal}%)` : ''}
                        </span>
                        <span className={`text-sm font-bold ${isDark ? 'text-green-400' : 'text-green-600'}`}>
                          −₹{discountAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className={`flex justify-between items-center pt-1 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                        <span className={`text-xs font-bold ${t}`}>Grand Total</span>
                        <span className={`text-sm font-black ${isDark ? 'text-orange-300' : 'text-orange-600'}`}>₹{grandTotal.toLocaleString('en-IN')}</span>
                      </div>
                    </>
                  )}
                </div>
                {/* Products summary */}
                <div className={`rounded-xl p-4 space-y-2 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                  <p className={`text-xs font-bold uppercase tracking-wider mb-2 ${s}`}>Products ({items.length})</p>
                  {items.map((it, idx) => (
                    <div key={idx} className="flex justify-between items-center">
                      <span className={`text-xs ${isDark ? 'text-white/70' : 'text-gray-700'}`}>{idx + 1}. {it.productName} <span className={`${s}`}>({it.category})</span></span>
                      <span className={`text-xs font-bold ${t}`}>x{it.quantity}</span>
                    </div>
                  ))}
                </div>
                <p className={`text-xs text-center ${s}`}>
                  Download will generate the PDF and deduct stock from inventory.
                </p>
                <div className="flex gap-3">
                  <button onClick={() => setShowPreview(false)}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${isDark ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    ← Back
                  </button>
                  <button onClick={handleDownload} disabled={generating}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition disabled:opacity-60">
                    {generating ? 'Generating...' : 'Download PDF'}
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
