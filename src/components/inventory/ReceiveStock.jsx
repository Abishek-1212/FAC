import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'

export default function ReceiveStock() {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ productId: '', quantity: '', supplierName: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return onSnapshot(collection(db, 'products'), snap => setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const product = products.find(p => p.id === form.productId)
      const qty = Number(form.quantity)

      // Update or create inventory record
      const invRef = doc(db, 'inventory', form.productId)
      const invSnap = await getDoc(invRef)
      if (invSnap.exists()) {
        await updateDoc(invRef, { quantity: (invSnap.data().quantity || 0) + qty, lastUpdated: serverTimestamp() })
      } else {
        await setDoc(invRef, { productId: form.productId, productName: product?.name || '', category: product?.category || '', quantity: qty, lastUpdated: serverTimestamp() })
      }

      // Log transaction
      await addDoc(collection(db, 'stock_transactions'), {
        type: 'purchase',
        productId: form.productId,
        productName: product?.name || '',
        quantity: qty,
        supplierName: form.supplierName,
        notes: form.notes,
        timestamp: serverTimestamp(),
      })

      toast.success(`${qty} units of ${product?.name} added to stock`)
      setForm({ productId: '', quantity: '', supplierName: '', notes: '' })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <h2 className="text-xl font-black text-gray-800">Receive Stock</h2>
      <p className="text-sm text-gray-500">Add products received from supplier</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Product</label>
            <select value={form.productId} onChange={e => setForm(f => ({ ...f, productId: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300">
              <option value="">Select product</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name} — {p.category}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Quantity</label>
              <input type="number" min={1} value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Name</label>
              <input value={form.supplierName} onChange={e => setForm(f => ({ ...f, supplierName: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 resize-none" />
          </div>
          <button type="submit" disabled={saving} className="w-full bg-aqua-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-aqua-600 transition disabled:opacity-60">
            {saving ? 'Adding...' : '📥 Add to Inventory'}
          </button>
        </form>
      </div>
    </div>
  )
}
