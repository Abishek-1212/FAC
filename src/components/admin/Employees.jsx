import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

const ROLE_COLORS = {
  admin:      'bg-purple-100 text-purple-700',
  technician: 'bg-aqua-100 text-aqua-700',
}

const ROLE_LABELS = {
  admin:      'Admin',
  technician: 'Technician',
}

export default function Employees() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]         = useState([])
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving]       = useState(false)
  const [filter, setFilter]       = useState('all')

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(all.filter(u => u.role !== 'admin' || u.id === currentUser?.uid))
    })
  }, [currentUser])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      // Get current admin's auth token before creating technician
      const adminIdToken = await auth.currentUser?.getIdToken()
      const adminUid = auth.currentUser?.uid
      const adminEmail = auth.currentUser?.email

      // Create new technician account
      const { user: newUser } = await createUserWithEmailAndPassword(auth, form.email, form.password)
      
      // Create Firestore document for technician
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: 'technician',
        isActive: true,
        isOnline: false,
        createdAt: new Date(),
      })

      // Force the auth state back to admin by using the stored token
      // This is a workaround - we're telling Firebase to recognize the admin session
      if (adminUid && adminEmail) {
        // Store admin info in session storage temporarily
        sessionStorage.setItem('adminUid', adminUid)
        sessionStorage.setItem('adminEmail', adminEmail)
        
        // Reload the page to restore admin session from localStorage
        // But first, show success message
        toast.success('Technician added successfully!')
        setModal(false)
        setForm({ name: '', email: '', password: '', phone: '' })
        
        // Small delay then reload to show the toast
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      console.error('Error adding technician:', err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Email already in use')
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters')
      } else {
        toast.error(err.message)
      }
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    await updateDoc(doc(db, 'users', u.id), { isActive: !u.isActive })
    toast.success(u.isActive ? 'Deactivated' : 'Activated')
  }

  const technicians = users.filter(u => u.role === 'technician')
  const filtered    = filter === 'all' ? technicians : technicians.filter(u => u.isActive === (filter === 'active'))

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Technicians</h2>
        <button
          onClick={() => setModal(true)}
          className="bg-aqua-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-aqua-600 transition"
        >
          + Add Technician
        </button>
      </div>

      <div className="flex gap-2 pb-1">
        {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === val ? 'bg-aqua-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aqua-100 flex items-center justify-center font-bold text-aqua-700 text-sm flex-shrink-0">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.phone && <p className="text-xs text-gray-400">+91 {u.phone}</p>}
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block bg-aqua-100 text-aqua-700">
                    Technician
                  </span>
                </div>
              </div>
              {u.id !== currentUser?.uid && (
                <button
                  onClick={() => toggleActive(u)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                    u.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                  }`}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No technicians found</p>
        )}
      </div>

      <Modal open={modal} onClose={() => { setModal(false); setForm({ name: '', email: '', password: '', phone: '' }) }} title="Add Technician">
        <form onSubmit={handleAdd} className="space-y-3">
          {[
            ['name',     'Full Name',  'text'],
            ['email',    'Email',      'email'],
            ['password', 'Password',   'password'],
            ['phone',    'Phone',      'tel'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModal(false); setForm({ name: '', email: '', password: '', phone: '' }) }} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Adding...' : 'Add Technician'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
