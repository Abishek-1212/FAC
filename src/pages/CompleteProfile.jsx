import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

const isValidPhone = (v) => /^[6-9]\d{9}$/.test(v)

export default function CompleteProfile() {
  const { user, fetchProfile, isProfileComplete, ROLE_ROUTES } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const fromGoogle = location.state?.fromGoogle || false

  const [form, setForm] = useState({
    name: user?.displayName || '',
    phone: '',
  })
  const [touched, setTouched] = useState({ name: false, phone: false })
  const [saving, setSaving] = useState(false)

  const nameValid  = form.name.trim().length >= 2
  const phoneValid = isValidPhone(form.phone)
  const canSubmit  = nameValid && phoneValid

  const set = (key) => (e) => {
    const val = key === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
    setForm(f => ({ ...f, [key]: val }))
  }
  const touch = (key) => () => setTouched(t => ({ ...t, [key]: true }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      const uid = user.uid
      const ref = doc(db, 'users', uid)

      if (fromGoogle) {
        // New Google user — create full Firestore doc
        await setDoc(ref, {
          uid,
          name: form.name.trim(),
          phone: form.phone,
          email: user.email,
          role: 'customer',
          isActive: true,
          isOnline: true,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
        })
      } else {
        // Existing user with incomplete profile — patch missing fields
        await updateDoc(ref, {
          name: form.name.trim(),
          phone: form.phone,
        })
      }

      const updated = await fetchProfile(uid)
      toast.success('Profile saved!')
      navigate(ROLE_ROUTES[updated?.role] || '/customer', { replace: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const nmCard     = { background: '#e0e5ec', boxShadow: 'none' }
  const nmInput    = { background: '#e0e5ec', boxShadow: 'inset 4px 4px 8px #b8bec7, inset -4px -4px 8px #ffffff', border: 'none', outline: 'none' }
  const nmIcon     = { background: '#e0e5ec', boxShadow: '5px 5px 10px #b8bec7, -5px -5px 10px #ffffff' }
  const nmInfo     = { background: '#d4eef5', boxShadow: 'inset 2px 2px 5px #b8bec7, inset -2px -2px 5px #ffffff' }
  const nmBtnActive = { background: 'linear-gradient(145deg, #0ea5c5, #06b6d4)', boxShadow: '5px 5px 12px #b8bec7, -5px -5px 12px #ffffff', border: 'none' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-aqua-600 to-aqua-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl w-full max-w-sm p-8"
        style={nmCard}
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={nmIcon}>
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#06b6d4" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-gray-700">Complete Profile</h1>
          <p className="text-gray-500 text-sm mt-1">
            {fromGoogle ? 'One last step to finish setup' : 'Fill in your details to continue'}
          </p>
        </div>

        {fromGoogle && user?.email && (
          <div className="rounded-xl px-4 py-3 mb-5 text-sm text-aqua-700 flex items-center gap-2" style={nmInfo}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#06b6d4" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            <span className="font-medium">{user.email}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              onBlur={touch('name')}
              placeholder="Your full name"
              required
              className="w-full mt-1 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400"
              style={nmInput}
            />
            {touched.name && !nameValid && <p className="text-xs text-red-500 mt-1">Enter at least 2 characters</p>}
          </div>

          {/* phone */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
            <div className="flex mt-1 gap-2">
              <span className="rounded-xl px-3 py-3 text-sm text-gray-500 font-semibold" style={nmInput}>+91</span>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                onBlur={touch('phone')}
                placeholder="9876543210"
                maxLength={10}
                required
                className="flex-1 rounded-xl px-4 py-3 text-sm text-gray-700 placeholder-gray-400"
                style={nmInput}
              />
            </div>
            {touched.phone && !phoneValid && <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number</p>}
          </div>

          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="w-full text-white font-bold py-3.5 rounded-xl transition-all duration-200 disabled:opacity-40 mt-2"
            style={nmBtnActive}
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
