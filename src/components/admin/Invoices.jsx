import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'
import { generateInvoice } from '../../utils/generateInvoice'

const formatDate = (ts) => {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function Invoices() {
  const { isDark } = useTheme()
  const [invoices, setInvoices] = useState([])
  const [completedJobs, setCompletedJobs] = useState([])
  const [modal, setModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [products, setProducts] = useState([{ name: '', qty: 1, price: 0 }])
  const [serviceCharge, setServiceCharge] = useState(0)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'invoices'), snap =>
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    const u2 = onSnapshot(query(collection(db, 'service_jobs'), where('status', '==', 'completed')), snap =>
      setCompletedJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2() }
  }, [])

  const handleGenerateInvoice = async () => {
    if (!selectedJob) return
    if (products.some(p => !p.name || p.qty <= 0 || p.price <= 0)) {
      toast.error('Please fill all product details')
      return
    }

    setSaving(true)
    try {
      const invoiceNumber = `FAC-${Date.now()}`
      const invoiceData = {
        invoiceNumber,
        customerName: selectedJob.customerName,
        customerPhone: selectedJob.customerPhone,
        customerAddress: selectedJob.customerAddress,
        technicianName: selectedJob.technicianName,
        serviceType: selectedJob.serviceType,
        problemDescription: selectedJob.problemDescription,
        serviceCharge: parseFloat(serviceCharge),
        products,
        notes,
      }

      await addDoc(collection(db, 'invoices'), {
        ...invoiceData,
        totalAmount: products.reduce((sum, p) => sum + (p.qty * p.price), 0) + parseFloat(serviceCharge),
        createdAt: serverTimestamp(),
      })
      
      generateInvoice(invoiceData)
      
      toast.success('✅ Invoice generated and saved!')
      setModal(false)
      setSelectedJob(null)
      setProducts([{ name: '', qty: 1, price: 0 }])
      setServiceCharge(0)
      setNotes('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Invoices</h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{invoices.length} total invoices</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setModal(true)}
          className={`px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-shadow ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + Generate Invoice
        </motion.button>
      </div>

      {/* Invoices List */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3">
          {invoices.map((invoice, i) => (
            <motion.div
              key={invoice.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl p-4 shadow-sm border ${
                isDark
                  ? 'bg-dark-card border-white/10 hover:border-cyan-500/30'
                  : 'bg-white border-gray-100 hover:shadow-md hover:border-aqua-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                    {invoice.customerName}
                  </p>
                  <p className={`text-xs mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    📋 {invoice.invoiceNumber}
                  </p>
                  <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                    📅 {formatDate(invoice.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${
                    isDark
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    ₹{invoice.totalAmount.toFixed(2)}
                  </span>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700'
                  }`}>
                    ✅ Generated
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {invoices.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`rounded-2xl p-12 text-center border border-dashed ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              <p className="text-4xl mb-3">📄</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                No invoices yet
              </p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

      {/* Generate Invoice Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Generate Invoice" size="lg">
        <div className="space-y-4 max-h-[70vh] overflow-y-auto scrollbar-hide">
          {/* Select Job */}
          <div>
            <label className={`text-xs font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Select Completed Job</label>
            <select
              value={selectedJob?.id || ''}
              onChange={(e) => {
                const job = completedJobs.find(j => j.id === e.target.value)
                setSelectedJob(job)
              }}
              className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
              }`}
            >
              <option value="">Choose a job...</option>
              {completedJobs.map(job => (
                <option key={job.id} value={job.id} className="text-gray-900">
                  {job.customerName} - {job.serviceType}
                </option>
              ))}
            </select>
          </div>

          {selectedJob && (
            <>
              {/* Job Details */}
              <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-bold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>JOB DETAILS</p>
                <div className="mt-2 space-y-1 text-sm">
                  <p className={isDark ? 'text-white' : 'text-gray-900'}><span className="font-semibold">Customer:</span> {selectedJob.customerName}</p>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}><span className="font-semibold">Phone:</span> {selectedJob.customerPhone}</p>
                  <p className={isDark ? 'text-white' : 'text-gray-900'}><span className="font-semibold">Type:</span> {selectedJob.serviceType}</p>
                </div>
              </div>

              {/* Products */}
              <div>
                <label className={`text-xs font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Products Used</label>
                <div className="space-y-2 mt-2">
                  {products.map((product, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Product name"
                        value={product.name}
                        onChange={(e) => {
                          const newProducts = [...products]
                          newProducts[idx].name = e.target.value
                          setProducts(newProducts)
                        }}
                        className={`col-span-2 border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={product.qty}
                        onChange={(e) => {
                          const newProducts = [...products]
                          newProducts[idx].qty = parseInt(e.target.value) || 0
                          setProducts(newProducts)
                        }}
                        className={`border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                      <input
                        type="number"
                        placeholder="Price"
                        value={product.price}
                        onChange={(e) => {
                          const newProducts = [...products]
                          newProducts[idx].price = parseFloat(e.target.value) || 0
                          setProducts(newProducts)
                        }}
                        className={`border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                        }`}
                      />
                    </div>
                  ))}
                </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setProducts([...products, { name: '', qty: 1, price: 0 }])}
                  className={`mt-2 text-xs font-bold px-3 py-1.5 rounded-lg ${
                    isDark ? 'bg-white/10 text-cyan-300 hover:bg-white/20' : 'bg-gray-100 text-cyan-600 hover:bg-gray-200'
                  }`}
                >
                  + Add Product
                </motion.button>
              </div>

              {/* Service Charge */}
              <div>
                <label className={`text-xs font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Service Charge</label>
                <input
                  type="number"
                  value={serviceCharge}
                  onChange={(e) => setServiceCharge(e.target.value)}
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>

              {/* Notes */}
              <div>
                <label className={`text-xs font-bold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none ${
                    isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
                  }`}
                />
              </div>

              {/* Total */}
              <div className={`rounded-xl p-3 ${isDark ? 'bg-cyan-500/10 border border-cyan-500/30' : 'bg-cyan-50 border border-cyan-200'}`}>
                <p className={`text-sm font-bold ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                  Total: ₹{(products.reduce((sum, p) => sum + (p.qty * p.price), 0) + parseFloat(serviceCharge || 0)).toFixed(2)}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-white/10">
                <button
                  onClick={() => setModal(false)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                    isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateInvoice}
                  disabled={saving}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${
                    isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' : 'bg-gradient-to-r from-cyan-500 to-cyan-600'
                  }`}
                >
                  {saving ? 'Generating...' : 'Generate & Download'}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
