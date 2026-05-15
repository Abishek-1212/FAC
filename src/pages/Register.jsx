import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

// ── helpers ──────────────────────────────────────────────────────────────────
const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const isValidPhone = (v) => /^[6-9]\d{9}$/.test(v)

async function checkEmailUnique(email) {
  const snap = await getDocs(query(collection(db, 'users'), where('email', '==', email)))
  return snap.empty
}

function useDebounce(value, delay = 500) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

function PasswordStrength({ password }) {
  const len = password.length
  const strength = len === 0 ? null : len < 6 ? 'weak' : len < 10 ? 'fair' : 'strong'
  const config = {
    weak:   { label: 'Weak',   color: 'bg-red-400',    text: 'text-red-500',    bars: 1 },
    fair:   { label: 'Fair',   color: 'bg-yellow-400', text: 'text-yellow-500', bars: 2 },
    strong: { label: 'Strong', color: 'bg-green-400',  text: 'text-green-500',  bars: 3 },
  }
  if (!strength) return null
  const c = config[strength]
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1, 2, 3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= c.bars ? c.color : 'bg-gray-200'}`} />
        ))}
      </div>
      <p className={`text-xs font-semibold ${c.text}`}>{c.label} password</p>
    </div>
  )
}

function FieldStatus({ checking, valid, touched, message }) {
  if (!touched || checking) return checking ? <p className="text-xs text-gray-400 mt-1">Checking...</p> : null
  if (!valid) return <p className="text-xs text-red-500 mt-1">{message}</p>
  return <p className="text-xs text-green-500 mt-1">✓ Looks good</p>
}

// ── main component ────────────────────────────────────────────────────────────
export default function Register() {
  const { registerWithEmail, fetchProfile, ROLE_ROUTES } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [saving, setSaving] = useState(false)

  // validation state
  const [emailUnique, setEmailUnique] = useState(null)   // null | true | false
  const [checkingEmail, setCheckingEmail] = useState(false)
  const [touched, setTouched] = useState({ name: false, email: false, phone: false })

  const debouncedEmail = useDebounce(form.email, 500)

  // debounced email uniqueness check
  useEffect(() => {
    if (!debouncedEmail || !isValidEmail(debouncedEmail)) { setEmailUnique(null); return }
    setCheckingEmail(true)
    checkEmailUnique(debouncedEmail).then(unique => {
      setEmailUnique(unique)
      setCheckingEmail(false)
    })
  }, [debouncedEmail])

  const nameValid   = form.name.trim().length >= 2
  const emailValid  = isValidEmail(form.email) && emailUnique === true
  const phoneValid  = isValidPhone(form.phone)
  const step0Ready  = nameValid && emailValid && phoneValid && !checkingEmail
  const step1Ready  = form.password.length >= 6

  const set = (key) => (e) => {
    const val = key === 'phone' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
    setForm(f => ({ ...f, [key]: val }))
  }
  const touch = (key) => () => setTouched(t => ({ ...t, [key]: true }))

  const handleStep0 = (e) => {
    e.preventDefault()
    if (!step0Ready) return
    setStep(1)
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!step1Ready) return
    setSaving(true)
    try {
      const cred = await registerWithEmail(form.email, form.password, form.name.trim(), form.phone, 'customer')
      const profile = await fetchProfile(cred.user.uid)
      toast.success('Account created!')
      navigate(ROLE_ROUTES[profile?.role] || '/customer', { replace: true })
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Email already in use'
        : err.code === 'auth/weak-password'
        ? 'Password too weak'
        : err.message
      toast.error(msg)
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
        {/* header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-aqua-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">💧</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Friends Aqua Care</p>
        </div>

        {/* step indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[0, 1].map(i => (
            <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= step ? 'bg-aqua-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ── STEP 0: profile info ── */}
          {step === 0 && (
            <motion.form
              key="step0"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleStep0}
              className="space-y-4"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 1 — Your Details</p>

              {/* name */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Full Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={set('name')}
                  onBlur={touch('name')}
                  placeholder="Abishek Kumar"
                  required
                  className={`w-full mt-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50 ${touched.name && !nameValid ? 'border-red-300' : 'border-gray-200'}`}
                />
                {touched.name && !nameValid && <p className="text-xs text-red-500 mt-1">Enter at least 2 characters</p>}
              </div>

              {/* email */}
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={set('email')}
                  onBlur={touch('email')}
                  placeholder="you@example.com"
                  required
                  className={`w-full mt-1 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50 ${touched.email && !emailValid && !checkingEmail ? 'border-red-300' : 'border-gray-200'}`}
                />
                <FieldStatus
                  checking={checkingEmail}
                  valid={emailValid}
                  touched={touched.email}
                  message={!isValidEmail(form.email) ? 'Enter a valid email' : 'Email already in use'}
                />
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
                disabled={!step0Ready}
                className="w-full bg-aqua-500 hover:bg-aqua-600 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-40 mt-1"
              >
                Continue →
              </button>
            </motion.form>
          )}

          {/* ── STEP 1: password ── */}
          {step === 1 && (
            <motion.form
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.18 }}
              onSubmit={handleRegister}
              className="space-y-4"
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 2 — Set Password</p>

              <div className="bg-aqua-50 rounded-xl px-4 py-3 text-sm text-aqua-700">
                <p className="font-semibold">{form.name}</p>
                <p className="text-xs text-aqua-500">{form.email} · +91 {form.phone}</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
                <div className="relative mt-1">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <PasswordStrength password={form.password} />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="flex-1 border border-gray-200 rounded-xl py-3 text-sm text-gray-600 font-medium hover:bg-gray-50 transition"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={!step1Ready || saving}
                  className="flex-1 bg-aqua-500 hover:bg-aqua-600 text-white font-bold py-3 rounded-xl transition disabled:opacity-40"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-gray-400 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-aqua-600 font-semibold hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  )
}
