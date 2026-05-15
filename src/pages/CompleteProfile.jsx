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

  return (
    <div className="min-h-screen bg-gradient-to-br from-aqua-600 to-aqua-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-aqua-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👤</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">Complete Profile</h1>
          <p className="text-gray-500 text-sm mt-1">
            {fromGoogle ? 'One last step to finish setup' : 'Fill in your details to continue'}
          </p>
        </div>

        {fromGoogle && user?.email && (
          <div className="bg-aqua-50 rounded-xl px-4 py-3 mb-5 text-sm text-aqua-700 flex items-center gap-2">
            <span>📧</span>
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
              className={`w-full mt-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50 ${touched.name && !nameValid ? 'border-red-300' : 'border-gray-200'}`}
            />
            {touched.name && !nameValid && <p className="text-xs text-red-500 mt-1">Enter at least 2 characters</p>}
          </div>

          {/* phone */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Phone Number</label>
            <div className="flex mt-1 gap-2">
              <span className="border border-gray-200 rounded-xl px-3 py-3 text-sm bg-gray-50 text-gray-500 font-semibold">+91</span>
              <input
                type="tel"
                value={form.phone}
                onChange={set('phone')}
                onBlur={touch('phone')}
                placeholder="9876543210"
                maxLength={10}
                required
                className={`flex-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50 ${touched.phone && !phoneValid ? 'border-red-300' : 'border-gray-200'}`}
              />
            </div>
            {touched.phone && !phoneValid && <p className="text-xs text-red-500 mt-1">Enter a valid 10-digit mobile number</p>}
          </div>

          <button
            type="submit"
            disabled={saving || !canSubmit}
            className="w-full bg-aqua-500 hover:bg-aqua-600 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-40 mt-2"
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
