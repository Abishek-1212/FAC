import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, doc,
  getDoc, updateDoc, serverTimestamp, query, where,
} from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'

const EMPTY_ITEM = { productId: '', quantity: '' }

export default function AssignStock() {
  const [jobs, setJobs]             = useState([])
  const [inventory, setInventory]   = useState([])
  const [assignments, setAssignments] = useState([])
  const [jobId, setJobId]           = useState('')
  const [items, setItems]           = useState([{ ...EMPTY_ITEM }])
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    const u1 = onSnapshot(
      query(collection(db, 'service_jobs'), where('status', 'in', ['assigned', 'in_progress'])),
      snap => setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u2 = onSnapshot(collection(db, 'inventory'), snap =>
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u3 = onSnapshot(collection(db, 'job_stock_assignment'), snap =>
      setAssignments(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
          .slice(0, 15)
      )
    )
    return () => { u1(); u2(); u3() }
  }, [])

  // ── item row helpers ──────────────────────────────────────────────────────
  const addRow    = () => setItems(prev => [...prev, { ...EMPTY_ITEM }])
  const removeRow = (i) => setItems(prev => prev.filter((_, idx) => idx !== i))
  const updateRow = (i, key, val) =>
    setItems(prev => prev.map((row, idx) => idx === i ? { ...row, [key]: val } : row))

  // stock available for a product minus what's already in other rows
  const availableStock = (productId, rowIndex) => {
    const inv = inventory.find(i => i.id === productId)
    if (!inv) return 0
    const alreadyInOtherRows = items.reduce((sum, row, idx) => {
      if (idx !== rowIndex && row.productId === productId)
        return sum + (Number(row.quantity) || 0)
      return sum
    }, 0)
    return inv.quantity - alreadyInOtherRows
  }

  // ── submit ────────────────────────────────────────────────────────────────
  const handleAssign = async (e) => {
    e.preventDefault()
    const job = jobs.find(j => j.id === jobId)

    // validate all rows
    for (const row of items) {
      if (!row.productId || !row.quantity) {
        toast.error('Fill in all product rows or remove empty ones')
        return
      }
      const avail = availableStock(row.productId, items.indexOf(row))
      if (Number(row.quantity) > avail) {
        const name = inventory.find(i => i.id === row.productId)?.productName
        toast.error(`Insufficient stock for "${name}" (available: ${avail})`)
        return
      }
    }

    // check duplicate product rows
    const ids = items.map(r => r.productId)
    if (new Set(ids).size !== ids.length) {
      toast.error('Duplicate products in list. Combine them into one row.')
      return
    }

    setSaving(true)
    try {
      for (const row of items) {
        const qty     = Number(row.quantity)
        const invItem = inventory.find(i => i.id === row.productId)

        // deduct inventory
        await updateDoc(doc(db, 'inventory', row.productId), {
          quantity: invItem.quantity - qty,
          lastUpdated: serverTimestamp(),
        })

        // assignment record
        await addDoc(collection(db, 'job_stock_assignment'), {
          jobId,
          technicianId:       job?.technicianId   || '',
          technicianName:     job?.technicianName || '',
          productId:          row.productId,
          productName:        invItem.productName,
          assignedQuantity:   qty,
          usedQuantity:       0,
          returnedQuantity:   0,
          status:             'assigned',
          timestamp:          serverTimestamp(),
        })

        // transaction log
        await addDoc(collection(db, 'stock_transactions'), {
          type:        'assignment',
          productId:   row.productId,
          productName: invItem.productName,
          quantity:    qty,
          toUser:      job?.technicianName || '',
          jobId,
          timestamp:   serverTimestamp(),
        })
      }

      toast.success(`${items.length} product${items.length > 1 ? 's' : ''} assigned to ${job?.technicianName}`)
      setJobId('')
      setItems([{ ...EMPTY_ITEM }])
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <h2 className="text-xl font-black text-gray-800">Assign Stock</h2>
      <p className="text-sm text-gray-500">Assign one or more products to a technician for a job</p>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <form onSubmit={handleAssign} className="space-y-4">

          {/* job selector */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Job</label>
            <select
              value={jobId}
              onChange={e => setJobId(e.target.value)}
              required
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
            >
              <option value="">Select job</option>
              {jobs.map(j => (
                <option key={j.id} value={j.id}>
                  {j.customerName} — {j.technicianName || 'Unassigned'}
                </option>
              ))}
            </select>
          </div>

          {/* product rows */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</label>
              <button
                type="button"
                onClick={addRow}
                className="text-xs text-aqua-600 font-bold hover:underline"
              >
                + Add Product
              </button>
            </div>

            <div className="space-y-2">
              {items.map((row, i) => {
                const avail = row.productId ? availableStock(row.productId, i) : null
                const overLimit = avail !== null && Number(row.quantity) > avail

                return (
                  <div key={i} className="flex gap-2 items-start">
                    {/* product select */}
                    <div className="flex-1">
                      <select
                        value={row.productId}
                        onChange={e => updateRow(i, 'productId', e.target.value)}
                        required
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
                      >
                        <option value="">Select product</option>
                        {inventory.map(inv => (
                          <option key={inv.id} value={inv.id}>
                            {inv.productName} (Stock: {inv.quantity})
                          </option>
                        ))}
                      </select>
                      {avail !== null && (
                        <p className={`text-xs mt-0.5 ml-1 ${overLimit ? 'text-red-500' : 'text-gray-400'}`}>
                          {overLimit ? `Max available: ${avail}` : `Available: ${avail}`}
                        </p>
                      )}
                    </div>

                    {/* quantity */}
                    <div className="w-20">
                      <input
                        type="number"
                        min={1}
                        max={avail ?? undefined}
                        value={row.quantity}
                        onChange={e => updateRow(i, 'quantity', e.target.value)}
                        placeholder="Qty"
                        required
                        className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 ${overLimit ? 'border-red-300' : 'border-gray-200'}`}
                      />
                    </div>

                    {/* remove row */}
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="w-10 h-10 rounded-xl bg-red-50 text-red-400 flex items-center justify-center text-lg hover:bg-red-100 transition flex-shrink-0"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* summary */}
          {items.some(r => r.productId && r.quantity) && (
            <div className="bg-aqua-50 rounded-xl px-4 py-3 text-xs text-aqua-700 space-y-1">
              <p className="font-bold mb-1">Assignment Summary</p>
              {items.filter(r => r.productId && r.quantity).map((r, i) => {
                const name = inventory.find(inv => inv.id === r.productId)?.productName
                return <p key={i}>• {name} × {r.quantity}</p>
              })}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-aqua-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-aqua-600 transition disabled:opacity-60"
          >
            {saving ? 'Assigning...' : `📤 Assign ${items.length > 1 ? `${items.length} Products` : 'to Technician'}`}
          </button>
        </form>
      </div>

      {/* recent assignments */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800">Recent Assignments</h3>
        </div>
        {assignments.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-8">No assignments yet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {assignments.map(a => {
              const missing = a.assignedQuantity - a.usedQuantity - a.returnedQuantity
              return (
                <div key={a.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-800 text-sm">{a.productName}</p>
                    <p className="text-xs text-gray-500">👷 {a.technicianName}</p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-600">Assigned: <span className="font-bold">{a.assignedQuantity}</span></p>
                    <p className="text-gray-600">Used: <span className="font-bold">{a.usedQuantity}</span></p>
                    {missing > 0 && <p className="text-red-500 font-bold">Missing: {missing}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
