import { useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc,
  deleteDoc, doc, serverTimestamp,
} from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

const EMPTY_PRODUCT = { name: '', sku: '', category: '', price: '', description: '' }

export default function Products() {
  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [modal, setModal]           = useState(false)
  const [catModal, setCatModal]     = useState(false)
  const [form, setForm]             = useState(EMPTY_PRODUCT)
  const [editing, setEditing]       = useState(null)
  const [saving, setSaving]         = useState(false)
  const [search, setSearch]         = useState('')
  const [newCat, setNewCat]         = useState('')
  const [addingCat, setAddingCat]   = useState(false)

  // ── live listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'products'), snap =>
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u2 = onSnapshot(collection(db, 'product_categories'), snap =>
      setCategories(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.name.localeCompare(b.name))
      )
    )
    return () => { u1(); u2() }
  }, [])

  // ── category actions ──────────────────────────────────────────────────────
  const handleAddCategory = async (e) => {
    e.preventDefault()
    const name = newCat.trim()
    if (!name) return
    if (categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      toast.error('Category already exists')
      return
    }
    setAddingCat(true)
    try {
      await addDoc(collection(db, 'product_categories'), { name, createdAt: serverTimestamp() })
      toast.success(`"${name}" added`)
      setNewCat('')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAddingCat(false)
    }
  }

  const handleDeleteCategory = async (cat) => {
    const inUse = products.some(p => p.category === cat.name)
    if (inUse) {
      toast.error(`"${cat.name}" is used by products. Reassign them first.`)
      return
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return
    await deleteDoc(doc(db, 'product_categories', cat.id))
    toast.success('Category deleted')
  }

  // ── product actions ───────────────────────────────────────────────────────
  const openAdd  = () => { setForm(EMPTY_PRODUCT); setEditing(null); setModal(true) }
  const openEdit = (p) => {
    setForm({ name: p.name, sku: p.sku || '', category: p.category || '', price: String(p.price || ''), description: p.description || '' })
    setEditing(p.id)
    setModal(true)
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, price: Number(form.price) }
      if (editing) {
        await updateDoc(doc(db, 'products', editing), data)
        toast.success('Product updated')
      } else {
        await addDoc(collection(db, 'products'), { ...data, createdAt: serverTimestamp() })
        toast.success('Product added')
      }
      setModal(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this product?')) return
    await deleteDoc(doc(db, 'products', id))
    toast.success('Deleted')
  }

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 pb-20 md:pb-0">

      {/* ── header ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Products</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setCatModal(true)}
            className="border border-aqua-300 text-aqua-600 px-3 py-2 rounded-xl text-sm font-bold hover:bg-aqua-50 transition"
          >
            🏷️ Categories
          </button>
          <button
            onClick={openAdd}
            className="bg-aqua-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-aqua-600 transition"
          >
            + Add Product
          </button>
        </div>
      </div>

      {/* ── search ── */}
      <input
        placeholder="Search products or categories..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 bg-white"
      />

      {/* ── product list ── */}
      <div className="grid gap-3">
        {filtered.map(p => (
          <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-800">{p.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {p.category && (
                  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full mr-1">{p.category}</span>
                )}
                {p.sku ? `SKU: ${p.sku}` : ''}
              </p>
              <p className="text-sm font-semibold text-aqua-600 mt-1">
                ₹{Number(p.price).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-sm">✏️</button>
              <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-xl bg-red-50 text-red-500 flex items-center justify-center text-sm">🗑️</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No products found</p>
        )}
      </div>

      {/* ── Manage Categories Modal ── */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Manage Categories">
        <div className="space-y-4">
          {/* add new */}
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="New category name..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
            />
            <button
              type="submit"
              disabled={addingCat || !newCat.trim()}
              className="bg-aqua-500 text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-aqua-600 transition disabled:opacity-50"
            >
              {addingCat ? '...' : 'Add'}
            </button>
          </form>

          {/* list */}
          {categories.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-6">No categories yet. Add one above.</p>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="w-7 h-7 rounded-lg bg-red-50 text-red-400 flex items-center justify-center text-xs hover:bg-red-100 transition"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-400">
            Categories in use by products cannot be deleted.
          </p>
        </div>
      </Modal>

      {/* ── Add / Edit Product Modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSave} className="space-y-3">
          {[['name', 'Product Name'], ['sku', 'SKU (optional)'], ['price', 'Price (₹)']].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type={key === 'price' ? 'number' : 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key !== 'sku'}
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
              />
            </div>
          ))}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</label>
              <button
                type="button"
                onClick={() => { setModal(false); setCatModal(true) }}
                className="text-xs text-aqua-600 font-semibold hover:underline"
              >
                + Manage
              </button>
            </div>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              required
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">⚠️ No categories yet. Add one first via "Manage".</p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Saving...' : editing ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
