import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

export default function TechnicianStockAssignment() {
  const [technicians, setTechnicians] = useState([])
  const [products, setProducts] = useState([])
  const [modal, setModal] = useState(false)
  const [selectedTechnician, setSelectedTechnician] = useState(null)
  const [assignments, setAssignments] = useState([])
  const [form, setForm] = useState({ productId: '', quantity: '' })
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap =>
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u2 = onSnapshot(collection(db, 'products'), snap =>
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u3 = onSnapshot(collection(db, 'stock_assignments'), snap =>
      setAssignments(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2(); u3() }
  }, [])

  const handleAssign = async (e) => {
    e.preventDefault()
    if (!selectedTechnician || !form.productId || !form.quantity) {
      toast.error('Please fill all fields')
      return
    }

    setSaving(true)
    try {
      const product = products.find(p => p.id === form.productId)
      await addDoc(collection(db, 'stock_assignments'), {
        technicianId: selectedTechnician.id,
        technicianName: selectedTechnician.name,
        productId: form.productId,
        productName: product?.name,
        quantity: Number(form.quantity),
        assignedBy: 'admin',
        assignedAt: serverTimestamp(),
        status: 'active',
      })
      toast.success('Stock assigned successfully!')
      setForm({ productId: '', quantity: '' })
      setModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const getTechnicianStock = (techId) => {
    return assignments.filter(a => a.technicianId === techId && a.status === 'active')
  }

  const filteredTechs = filter === 'all' ? technicians : technicians.filter(t => t.isActive)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Assign Stock to Technicians</h2>
        <button
          onClick={() => { setSelectedTechnician(null); setModal(true) }}
          className="bg-cyan-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-cyan-600 transition"
        >
          + Assign Stock
        </button>
      </div>

      <div className="flex gap-2 pb-1">
        {[['all', 'All'], ['active', 'Active Only']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === val ? 'bg-cyan-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filteredTechs.map(tech => {
          const stock = getTechnicianStock(tech.id)
          return (
            <div key={tech.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-gray-800">{tech.name}</p>
                  <p className="text-xs text-gray-500">{tech.email}</p>
                </div>
                <button
                  onClick={() => { setSelectedTechnician(tech); setModal(true) }}
                  className="bg-cyan-50 hover:bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
                >
                  + Assign
                </button>
              </div>

              {stock.length > 0 ? (
                <div className="space-y-2">
                  {stock.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg text-sm">
                      <div>
                        <p className="font-semibold text-gray-700">{item.productName}</p>
                        <p className="text-xs text-gray-500">Assigned: {item.assignedAt?.toDate?.().toLocaleDateString()}</p>
                      </div>
                      <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full font-bold text-sm">
                        {item.quantity}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No stock assigned yet</p>
              )}
            </div>
          )
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Assign Stock">
        <form onSubmit={handleAssign} className="space-y-3">
          {selectedTechnician && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700">Assigning to:</p>
              <p className="text-sm font-bold text-blue-900">{selectedTechnician.name}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Product</label>
            <select
              value={form.productId}
              onChange={e => setForm(f => ({ ...f, productId: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              <option value="">Select product</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} - ₹{p.price}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Quantity</label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              required
              min="1"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-cyan-500 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-60">
              {saving ? 'Assigning...' : 'Assign Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
