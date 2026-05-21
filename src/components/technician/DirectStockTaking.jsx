import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

const DAILY_LIMIT = 20 // Technician can take max 20 items per day

export default function DirectStockTaking() {
  const { user: currentUser, profile } = useAuth()
  const [products, setProducts] = useState([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ productId: '', quantity: '' })
  const [saving, setSaving] = useState(false)
  const [myStock, setMyStock] = useState([])
  const [todaysTakes, setTodaysTakes] = useState([])

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'products'), snap =>
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )

    if (currentUser?.uid) {
      const u2 = onSnapshot(
        query(collection(db, 'stock_assignments'), where('technicianId', '==', currentUser.uid)),
        snap => setMyStock(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )

      // Get today's direct takes
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)

      const u3 = onSnapshot(
        query(
          collection(db, 'direct_stock_takes'),
          where('technicianId', '==', currentUser.uid),
          where('takenAt', '>=', today),
          where('takenAt', '<', tomorrow)
        ),
        snap => setTodaysTakes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      )

      return () => { u1(); u2(); u3() }
    }

    return () => u1()
  }, [currentUser])

  const getTodaysTotal = () => {
    return todaysTakes.reduce((sum, take) => sum + (take.quantity || 0), 0)
  }

  const getRemainingLimit = () => {
    return DAILY_LIMIT - getTodaysTotal()
  }

  const handleTakeStock = async (e) => {
    e.preventDefault()
    const quantity = Number(form.quantity)
    const remaining = getRemainingLimit()

    if (quantity > remaining) {
      toast.error(`You can only take ${remaining} more items today (limit: ${DAILY_LIMIT})`)
      return
    }

    setSaving(true)
    try {
      const product = products.find(p => p.id === form.productId)
      await addDoc(collection(db, 'direct_stock_takes'), {
        technicianId: currentUser.uid,
        technicianName: profile?.name,
        productId: form.productId,
        productName: product?.name,
        quantity: quantity,
        takenAt: serverTimestamp(),
        status: 'active',
      })

      // Also add to stock_assignments for unified view
      await addDoc(collection(db, 'stock_assignments'), {
        technicianId: currentUser.uid,
        technicianName: profile?.name,
        productId: form.productId,
        productName: product?.name,
        quantity: quantity,
        assignedBy: 'self',
        assignedAt: serverTimestamp(),
        status: 'active',
      })

      toast.success('Stock taken successfully!')
      setForm({ productId: '', quantity: '' })
      setModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const totalStock = myStock.reduce((sum, item) => sum + (item.quantity || 0), 0)
  const todaysUsed = getTodaysTotal()
  const remaining = getRemainingLimit()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">My Stock</h2>
        <button
          onClick={() => setModal(true)}
          disabled={remaining <= 0}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition ${
            remaining > 0
              ? 'bg-cyan-500 text-white hover:bg-cyan-600'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
          }`}
        >
          + Take Stock
        </button>
      </div>

      {/* Daily Limit Info */}
      <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-2xl p-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Daily Limit</p>
            <p className="text-2xl font-black text-cyan-600">{DAILY_LIMIT}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Taken Today</p>
            <p className="text-2xl font-black text-orange-600">{todaysUsed}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 mb-1">Remaining</p>
            <p className={`text-2xl font-black ${remaining > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {remaining}
            </p>
          </div>
        </div>
        <div className="mt-3 bg-white rounded-lg h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all"
            style={{ width: `${(todaysUsed / DAILY_LIMIT) * 100}%` }}
          />
        </div>
      </div>

      {/* Total Stock */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
        <p className="text-sm font-semibold text-gray-600 mb-2">Total Available Stock</p>
        <p className="text-3xl font-black text-cyan-600">{totalStock} items</p>
      </div>

      {/* Stock List */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-gray-700">Stock Breakdown</h3>
        {myStock.length > 0 ? (
          <div className="grid gap-2">
            {myStock.map(item => (
              <div key={item.id} className="bg-white rounded-xl p-3 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{item.productName}</p>
                    <p className="text-xs text-gray-500">
                      {item.assignedBy === 'admin' ? '📦 Admin Assigned' : '🤝 Self Taken'}
                    </p>
                  </div>
                  <span className="bg-cyan-100 text-cyan-700 px-3 py-1 rounded-full font-bold text-sm">
                    {item.quantity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400 text-sm py-8">No stock assigned yet</p>
        )}
      </div>

      {/* Take Stock Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Take Stock from Inventory">
        <form onSubmit={handleTakeStock} className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-700">
              ⚠️ You can take max {remaining} items today
            </p>
          </div>

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
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Quantity (Max: {remaining})</label>
            <input
              type="number"
              value={form.quantity}
              onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
              required
              min="1"
              max={remaining}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving || remaining <= 0} className="flex-1 bg-cyan-500 text-white rounded-lg py-2 text-sm font-bold disabled:opacity-60">
              {saving ? 'Taking...' : 'Take Stock'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
