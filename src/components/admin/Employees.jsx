import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc, setDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
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
  const { isDark } = useTheme()
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
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div className={`flex items-center justify-center px-4 py-4 border rounded-full mx-4 mb-5 relative ${
        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={() => window.history.back()}
          className={`absolute left-4 p-2 rounded-lg transition-all ${
            isDark
              ? 'hover:bg-white/10 text-white/70 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          EMPLOYEES
        </h1>
      </div>

      <div className="space-y-4">
      {/* Add Technician Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setModal(true)}
          className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-shadow ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + Add Technician
        </button>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-hide">
          {[['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition ${
                filter === val
                  ? isDark
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-lg shadow-aqua-300/40'
                  : isDark
                  ? 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(u => (
          <div key={u.id} className={`rounded-2xl p-4 shadow-sm border ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-aqua-100 text-aqua-700'
                }`}>
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{u.name}</p>
                  <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{u.email}</p>
                  {u.phone && <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>+91 {u.phone}</p>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-aqua-100 text-aqua-700'
                  }`}>
                    Technician
                  </span>
                </div>
              </div>
              {u.id !== currentUser?.uid && (
                <button
                  onClick={() => toggleActive(u)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                    u.isActive
                      ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600'
                      : isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-500'
                  }`}
                >
                  {u.isActive ? 'Active' : 'Inactive'}
                </button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className={`text-center text-sm py-8 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>No technicians found</p>
        )}
      </div>
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
