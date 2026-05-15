import { useState, useRef, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { doc, updateDoc } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { sendPasswordResetEmail, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth'
import toast from 'react-hot-toast'
import Modal from './Modal'
import { motion, AnimatePresence } from 'framer-motion'
import PropTypes from 'prop-types'

export default function Layout({ children, navItems, title }) {
  const { profile, logout, fetchProfile, user } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const menuRef = useRef(null)

  const [profileOpen, setProfileOpen] = useState(false)
  const [pwModal, setPwModal] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', phone: '' })
  const [saving, setSaving] = useState(false)
  const [pwStep, setPwStep] = useState('idle')
  const [pwEmail, setPwEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [newPw, setNewPw] = useState('')
  const [pwSaving, setPwSaving] = useState(false)

  const isAdmin = profile?.role === 'admin'
  const inInventory = location.pathname.startsWith('/inventory')
  const switchTo = inInventory ? '/admin' : '/inventory'
  const switchLabel = inInventory ? 'Admin Panel' : 'Inventory'

  // Check if we're in a sub-section (not root dashboard)
  const isInSection = location.pathname !== '/admin' && location.pathname !== '/technician' && location.pathname !== '/inventory'

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setProfileOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleLogout = async () => {
    setProfileOpen(false)
    await logout()
    navigate('/login')
    toast.success('Logged out')
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (editForm.name.trim().length < 2) { toast.error('Name too short'); return }
    if (!/^[6-9]\d{9}$/.test(editForm.phone)) { toast.error('Invalid phone'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'users', user.uid), { name: editForm.name.trim(), phone: editForm.phone })
      await fetchProfile(user.uid)
      toast.success('Profile updated')
      setEditMode(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    if (!pwEmail) { toast.error('Enter email'); return }
    setPwSaving(true)
    try {
      await sendPasswordResetEmail(auth, pwEmail)
      setPwStep('sent')
      toast.success('Reset email sent!')
    } catch (err) {
      toast.error('Failed to send email')
    } finally {
      setPwSaving(false)
    }
  }

  const handleVerifyAndReset = async (e) => {
    e.preventDefault()
    if (!otp.trim()) { toast.error('Enter OTP'); return }
    if (newPw.length < 6) { toast.error('Password too short'); return }
    setPwSaving(true)
    try {
      await verifyPasswordResetCode(auth, otp.trim())
      await confirmPasswordReset(auth, otp.trim(), newPw)
      toast.success('Password changed!')
      setPwStep('idle')
      setPwModal(false)
      await logout()
      navigate('/login')
    } catch (err) {
      toast.error('Invalid OTP')
    } finally {
      setPwSaving(false)
    }
  }

  const openChangePassword = () => {
    setProfileOpen(false)
    setPwStep('idle')
    setPwEmail(user?.email || '')
    setOtp('')
    setNewPw('')
    setPwModal(true)
  }

  const openEditProfile = () => {
    setProfileOpen(false)
    setEditForm({ name: profile?.name || '', phone: profile?.phone || '' })
    setEditMode(true)
  }

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-dark-bg' : 'bg-light-bg'}`}>
      {/* Top Nav */}
      <header className={`sticky top-0 z-50 backdrop-blur-xl border-b ${isDark ? 'bg-dark-card/80 border-dark-border' : 'bg-white/80 border-light-border'}`}>
        <div className="max-w-full mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Back button when in section */}
            {isInSection && (
              <button
                onClick={() => navigate(-1)}
                className={`p-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/5 text-white/60 hover:text-white' : 'hover:bg-black/5 text-gray-600 hover:text-gray-900'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'} shadow-glow-cyan-sm`}>
                <span className="text-white text-lg">💧</span>
              </div>
              <span className={`font-black text-base tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Friends Aqua Care</span>
              <span className={isDark ? 'text-white/20' : 'text-gray-300'}>|</span>
              <span className={`font-semibold text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{title}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark/Light toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2.5 rounded-xl transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 text-yellow-400' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
            >
              {isDark ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Profile Avatar */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
              >
                <span className={`text-sm font-medium hidden sm:block ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{profile?.name}</span>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black shadow-glow-cyan-sm ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
                  {profile?.name?.[0]?.toUpperCase() || 'A'}
                </div>
              </button>

              {/* Immediate Profile Popup */}
              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`absolute right-0 top-14 w-80 rounded-2xl shadow-2xl overflow-hidden z-50 ${isDark ? 'bg-dark-card border border-dark-border' : 'bg-white border border-light-border'}`}
                  >
                    {/* Profile Info Table */}
                    <div className={`p-5 border-b ${isDark ? 'border-dark-border' : 'border-light-border'}`}>
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-black text-xl shadow-glow-cyan ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
                          {profile?.name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className={`font-black text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name}</p>
                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full inline-block mt-1 ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                            {profile?.role === 'admin' ? 'Admin' : 'Technician'}
                          </span>
                        </div>
                      </div>

                      {/* Info Table */}
                      <div className="space-y-2">
                        {[
                          { icon: '👤', label: 'Name', value: profile?.name },
                          { icon: '📞', label: 'Phone', value: `+91 ${profile?.phone || '—'}` },
                          { icon: '✉️', label: 'Email', value: user?.email },
                          { icon: '🔑', label: 'Password', value: '••••••••' },
                        ].map(row => (
                          <div key={row.label} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                            <span className="text-base">{row.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{row.label}</p>
                              <p className={`text-sm font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{row.value}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action Buttons */}
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        <button
                          onClick={openEditProfile}
                          className={`text-xs font-bold py-2.5 rounded-xl transition-all ${isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'}`}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={openChangePassword}
                          className={`text-xs font-bold py-2.5 rounded-xl transition-all ${isDark ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                        >
                          🔑 Password
                        </button>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="py-2">
                      {isAdmin && (
                        <button
                          onClick={() => { setProfileOpen(false); navigate(switchTo) }}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold transition ${isDark ? 'text-cyan-400 hover:bg-white/5' : 'text-cyan-600 hover:bg-gray-50'}`}
                        >
                          <span>📦</span>
                          Switch to {switchLabel}
                        </button>
                      )}
                      <div className={`mx-4 h-px ${isDark ? 'bg-white/5' : 'bg-gray-200'} my-1`} />
                      <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold transition ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                      >
                        <span>🚪</span>
                        Logout
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - only show when NOT in section */}
        {!isInSection && (
          <aside className={`hidden md:flex flex-col w-64 border-r py-6 px-4 gap-2 ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'}`}>
            <div className={`px-3 pb-4 mb-3 border-b ${isDark ? 'border-dark-border' : 'border-light-border'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-white shadow-glow-cyan-sm ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
                  {profile?.name?.[0]?.toUpperCase() || 'A'}
                </div>
                <div>
                  <p className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full inline-block mt-1 ${isDark ? 'bg-cyan-500/20 text-cyan-400' : 'bg-cyan-100 text-cyan-700'}`}>
                    {profile?.role === 'admin' ? 'Admin' : 'Technician'}
                  </span>
                </div>
              </div>
            </div>

            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/admin' || item.to === '/technician' || item.to === '/inventory'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? isDark
                        ? 'bg-cyan-500/20 text-cyan-400 shadow-glow-cyan-sm'
                        : 'bg-cyan-50 text-cyan-600'
                      : isDark
                      ? 'text-white/60 hover:text-white hover:bg-white/5'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`
                }
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
          </aside>
        )}

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Edit Profile Modal */}
      <Modal open={editMode} onClose={() => setEditMode(false)} title="Edit Profile">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Full Name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
              required
              className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
            />
          </div>
          <div>
            <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Phone</label>
            <div className="flex mt-1 gap-2">
              <span className={`border rounded-xl px-3 py-2.5 text-sm font-semibold ${isDark ? 'bg-white/5 border-white/10 text-white/60' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>+91</span>
              <input
                type="tel"
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                maxLength={10}
                required
                className={`flex-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setEditMode(false)} className={`flex-1 border rounded-xl py-2.5 text-sm font-semibold ${isDark ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Cancel</button>
            <button type="submit" disabled={saving} className={`flex-1 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-glow-cyan-sm' : 'bg-gradient-to-r from-light-primary to-cyan-500'}`}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Change Password Modal */}
      <Modal open={pwModal} onClose={() => { setPwModal(false); setPwStep('idle') }} title="Change Password">
        <div className="space-y-4">
          {pwStep === 'idle' && (
            <>
              <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Enter email to receive reset code</p>
              <form onSubmit={handleSendOtp} className="space-y-3">
                <input
                  type="email"
                  value={pwEmail}
                  onChange={e => setPwEmail(e.target.value)}
                  required
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                />
                <button
                  type="submit"
                  disabled={pwSaving}
                  className={`w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-glow-cyan-sm' : 'bg-gradient-to-r from-light-primary to-cyan-500'}`}
                >
                  {pwSaving ? 'Sending...' : '📧 Send Reset Email'}
                </button>
              </form>
            </>
          )}
          {pwStep === 'sent' && (
            <>
              <div className={`border rounded-xl px-3 py-2.5 text-xs ${isDark ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-green-50 border-green-200 text-green-700'}`}>
                ✅ Reset email sent to <strong>{pwEmail}</strong>
              </div>
              <form onSubmit={handleVerifyAndReset} className="space-y-3">
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value)}
                  placeholder="Paste OTP code"
                  required
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                />
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  minLength={6}
                  required
                  className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 ${isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'}`}
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPwStep('idle')} className={`flex-1 border rounded-xl py-2 text-sm font-semibold ${isDark ? 'border-white/10 text-white/60 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>Back</button>
                  <button type="submit" disabled={pwSaving} className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl py-2 text-sm font-bold disabled:opacity-60">
                    {pwSaving ? 'Verifying...' : '✅ Confirm'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
  navItems: PropTypes.arrayOf(
    PropTypes.shape({
      to: PropTypes.string.isRequired,
      icon: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired
    })
  ).isRequired,
  title: PropTypes.string.isRequired
}
