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
    setModal(false)
  }

  const filtered = products.filter(p =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6 pb-20 md:pb-0">

      {/* ── header section ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.history.back()}
              className="p-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition"
              title="Back to Home"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-black text-gray-900">Products</h1>
             
            </div>
          </div>
          <button
            onClick={openAdd}
            className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            + Add Product
          </button>
        </div>

        {/* ── search & filter bar ── */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              placeholder="Search products or categories..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent bg-white transition"
            />
          </div>
          <button
            onClick={() => setCatModal(true)}
            className="border-2 border-gray-200 text-gray-700 px-4 py-3 rounded-xl text-sm font-bold hover:bg-gray-50 transition flex items-center gap-2"
          >
            🏷️ Categories
          </button>
        </div>
      </div>

      {/* ── product list ── */}
      <div className="space-y-8">
        {filtered.length === 0 ? (
          <div className="text-center py-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl border border-gray-200">
            <p className="text-5xl mb-3">📦</p>
            <p className="text-gray-700 font-semibold text-base">No products found</p>
            <p className="text-sm text-gray-500 mt-2">Try adjusting your search or add a new product</p>
          </div>
        ) : (() => {
          const grouped = {}
          filtered.forEach(p => {
            const cat = p.category || 'Uncategorized'
            if (!grouped[cat]) grouped[cat] = []
            grouped[cat].push(p)
          })
          return Object.entries(grouped).map(([category, products]) => (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-gray-200">
                <div className="w-1 h-6 bg-gradient-to-b from-cyan-500 to-cyan-600 rounded-full"></div>
                <h3 className="text-xl font-bold text-gray-900">{category}</h3>
                <span className="ml-auto text-sm font-semibold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{products.length} items</span>
              </div>
              <div className="grid gap-3">
                {products.map(p => (
                  <div key={p.id} onClick={() => openEdit(p)} className="bg-white rounded-xl p-4 shadow-sm border border-gray-200 hover:shadow-lg hover:border-cyan-300 transition-all duration-200 cursor-pointer">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-base text-gray-900 truncate mb-1">{p.name}</p>
                        {p.description && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-1">{p.description}</p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          {p.sku && (
                            <span className="font-mono bg-gray-50 px-2 py-1 rounded border border-gray-200">SKU: {p.sku}</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-2xl font-bold text-cyan-600">₹{Number(p.price).toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        })()}
      </div>

      {/* ── Manage Categories Modal ── */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title="Manage Categories">
        <div className="space-y-4">
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <input
              value={newCat}
              onChange={e => setNewCat(e.target.value)}
              placeholder="New category name..."
              className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={addingCat || !newCat.trim()}
              className="bg-gradient-to-r from-cyan-500 to-cyan-600 text-white px-6 py-3 rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addingCat ? '...' : 'Add'}
            </button>
          </form>

          {categories.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <p className="text-gray-500 text-sm">No categories yet. Add one above.</p>
            </div>
          ) : (
            <div className="grid gap-2 max-h-64 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-3 transition group">
                  <span className="text-sm font-semibold text-gray-700">{cat.name}</span>
                  <button
                    onClick={() => handleDeleteCategory(cat)}
                    className="w-8 h-8 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center text-sm transition opacity-0 group-hover:opacity-100"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            ℹ️ Categories in use by products cannot be deleted.
          </p>
        </div>
      </Modal>

      {/* ── Add / Edit Product Modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSave} className="space-y-3 max-h-[55vh] overflow-y-auto pr-2">
          <div className="grid grid-cols-2 gap-3">
            {[['name', 'Product Name'], ['sku', 'SKU (optional)']].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-600 block mb-1.5">{label}</label>
                <input
                  type="text"
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={key !== 'sku'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent transition"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Price (₹)</label>
            <input
              type="number"
              value={form.price}
              onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent transition"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-gray-600">Category</label>
              <button
                type="button"
                onClick={() => { setModal(false); setCatModal(true) }}
                className="text-xs text-cyan-600 font-semibold hover:text-cyan-700 transition"
              >
                + Manage
              </button>
            </div>
            <select
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent transition"
            >
              <option value="">Select category</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                ⚠️ No categories yet. Add one first.
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-600 block mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Enter product description..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:border-transparent resize-none transition"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100 sticky bottom-0 bg-white">
            {editing && (
              <button
                type="button"
                onClick={() => handleDelete(editing)}
                className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg py-2 text-sm font-semibold transition"
              >
                🗑️ Delete
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-lg py-2 text-sm font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : editing ? 'Update' : 'Add Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
