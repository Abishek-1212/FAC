import { useState, useRef, useEffect } from 'react'
import logo from '../../assets/logo.png'
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
  const [profileViewModal, setProfileViewModal] = useState(false)
  const [settingsModal, setSettingsModal] = useState(false)
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
  const isInSection = location.pathname !== '/admin' && location.pathname !== '/technician' && location.pathname !== '/inventory' && !location.pathname.startsWith('/admin/') && !location.pathname.startsWith('/inventory/')

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
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-dark-bg' : 'bg-light-bg'}`}>
      {/* Top Nav */}
      <header className={`shrink-0 sticky top-0 z-50 backdrop-blur-xl border-b ${isDark ? 'bg-dark-card/90 border-dark-border' : 'bg-white/90 border-light-border'}`}>
        <div className="max-w-full mx-auto px-6 h-16 grid grid-cols-3 items-center">
          {/* Left: Logo + back button */}
          <div className="flex items-center gap-3">
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
            <motion.img
              src={logo}
              alt="Logo"
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="h-12 w-12 object-contain"
            />
          </div>

          {/* Center: Company name only */}
          <div className="flex items-center justify-center whitespace-nowrap">
            <span className={`font-black text-lg tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>Friends Aqua Care</span>
          </div>

          {/* Right: profile */}
          <div className="flex items-center gap-3 justify-end">
            {/* Profile Avatar */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setProfileOpen(v => !v)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-100'}`}
              >
                <div className="text-right hidden sm:block">
                  <p className={`text-sm font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name}</p>
                  <p className={`text-xs font-semibold capitalize ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{profile?.role}</p>
                </div>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black ring-2 ring-cyan-400 shadow-glow-cyan-sm ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
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
                    className={`absolute right-0 top-14 w-64 rounded-2xl shadow-2xl overflow-hidden z-50 ${isDark ? 'bg-dark-card border border-dark-border' : 'bg-white border border-light-border'}`}
                  >
                    {/* Profile Header */}
                    <div className={`p-4 border-b ${isDark ? 'border-dark-border' : 'border-light-border'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-lg shadow-glow-cyan ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
                          {profile?.name?.[0]?.toUpperCase() || 'A'}
                        </div>
                        <div>
                          <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name}</p>
                          <p className={`text-xs font-semibold capitalize ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{profile?.role}</p>
                        </div>
                      </div>
                    </div>

                    {/* Menu Options */}
                    <div className="py-2">
                      <button
                        onClick={() => { setProfileOpen(false); setProfileViewModal(true) }}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold transition ${isDark ? 'text-cyan-400 hover:bg-white/5' : 'text-cyan-600 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        View Profile
                      </button>
                      <button
                        onClick={() => { setProfileOpen(false); setSettingsModal(true) }}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold transition ${isDark ? 'text-blue-400 hover:bg-white/5' : 'text-blue-600 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <button
                        onClick={handleLogout}
                        className={`w-full flex items-center gap-3 px-5 py-3 text-sm font-semibold transition ${isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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

      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Sidebar - only show when NOT in section */}
        {!isInSection && (
          <aside className={`hidden md:flex flex-col w-64 border-r py-6 px-4 gap-2 overflow-y-auto scrollbar-hide ${isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'}`}>
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

        <main className="flex-1 overflow-y-auto scrollbar-hide p-6 md:p-8 pb-24">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>

      {/* Fixed Glassmorphic Footer — admin only */}
      {isAdmin && (
        <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`pointer-events-auto flex items-center gap-1 p-1.5 rounded-full border
              shadow-[0_20px_60px_rgba(0,0,0,0.3),0_4px_16px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.2)]
              ${isDark ? 'bg-white/8 backdrop-blur-2xl border-white/15' : 'bg-white/70 backdrop-blur-2xl border-white/90'}`}
            style={{ perspective: '600px', transformStyle: 'preserve-3d', transform: 'rotateX(3deg)' }}
          >
            {/* Admin pill */}
            <motion.button
              onClick={() => navigate('/admin')}
              whileTap={{ scale: 0.94, y: 1 }}
              whileHover={{ y: -1 }}
              className={`flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-bold transition-all duration-200
                ${!inInventory
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-[0_4px_20px_rgba(6,182,212,0.6),inset_0_1px_0_rgba(255,255,255,0.25)]'
                  : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-700'
                }`}
            >
              <span>🛡️</span> Admin Panel
            </motion.button>

            <div className={`w-px h-5 ${isDark ? 'bg-white/15' : 'bg-gray-300'}`} />

            {/* Inventory pill */}
            <motion.button
              onClick={() => navigate('/inventory')}
              whileTap={{ scale: 0.94, y: 1 }}
              whileHover={{ y: -1 }}
              className={`flex items-center gap-2 px-7 py-2.5 rounded-full text-sm font-bold transition-all duration-200
                ${inInventory
                  ? 'bg-gradient-to-r from-violet-500 to-purple-600 text-white shadow-[0_4px_20px_rgba(139,92,246,0.6),inset_0_1px_0_rgba(255,255,255,0.25)]'
                  : isDark ? 'text-white/40 hover:text-white/70' : 'text-gray-400 hover:text-gray-700'
                }`}
            >
              <span>📦</span> Inventory
            </motion.button>
          </motion.div>
        </div>
      )}

      {/* View Profile Modal */}
      <Modal open={profileViewModal} onClose={() => setProfileViewModal(false)} title="Profile Details">
        <div className="space-y-4">
          <div className="flex justify-center mb-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl shadow-glow-cyan ${isDark ? 'bg-gradient-to-br from-cyan-400 to-cyan-600' : 'bg-gradient-to-br from-light-primary to-cyan-500'}`}>
              {profile?.name?.[0]?.toUpperCase() || 'A'}
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: 'Full Name', value: profile?.name },
              { label: 'Email', value: user?.email },
              { label: 'Phone', value: `+91 ${profile?.phone || '—'}` },
              { label: 'Role', value: profile?.role === 'admin' ? 'Administrator' : 'Technician' },
            ].map(item => (
              <div key={item.label} className={`rounded-xl px-4 py-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
                <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{item.label}</p>
                <p className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{item.value}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => { setProfileViewModal(false); setEditMode(true) }}
            className={`w-full rounded-xl py-2.5 text-sm font-bold text-white ${isDark ? 'bg-gradient-to-r from-cyan-500 to-cyan-600' : 'bg-gradient-to-r from-light-primary to-cyan-500'}`}
          >
            Edit Profile
          </button>
        </div>
      </Modal>

      {/* Settings Modal */}
      <Modal open={settingsModal} onClose={() => setSettingsModal(false)} title="Settings">
        <div className="space-y-4">
          <div className={`rounded-xl px-4 py-3 ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>App Version</p>
            <p className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>v1.0.0</p>
          </div>
          <div className={`rounded-xl px-4 py-3 flex items-center justify-between ${isDark ? 'bg-white/5 border border-white/10' : 'bg-gray-50 border border-gray-200'}`}>
            <div>
              <p className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>Theme</p>
              <p className={`text-sm font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>{isDark ? 'Dark Mode' : 'Light Mode'}</p>
            </div>
            <button
              onClick={() => { toggleTheme(); setSettingsModal(false) }}
              className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${isDark ? 'bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30' : 'bg-cyan-50 text-cyan-600 hover:bg-cyan-100'}`}
            >
              Toggle
            </button>
          </div>
          <button
            onClick={() => { setSettingsModal(false); openChangePassword() }}
            className={`w-full rounded-xl py-2.5 text-sm font-bold text-white ${isDark ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gradient-to-r from-blue-500 to-blue-600'}`}
          >
            Change Password
          </button>
        </div>
      </Modal>

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
