import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'
import PropTypes from 'prop-types'
import { motion, AnimatePresence } from 'framer-motion'

export default function TechnicianLayout({ children }) {
  const { profile, logout } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  })
  
  // Check if current page needs back button
  const showBackButton = [
    '/technician/reports',
    '/technician/stock',
    '/technician/my-invoices',
    '/technician/take-stock',
    '/technician/return-stock'
  ].includes(location.pathname)

  const openProfile = () => {
    setFormData({
      name: profile?.name || '',
      phone: profile?.phone || profile?.phoneNumber || '',
      email: profile?.email || ''
    })
    setShowProfile(true)
    setEditing(false)
    setShowAvatarMenu(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const getInitials = (name) => {
    if (!name) return 'T'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required')
      return
    }

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name: formData.name.trim(),
        phone: formData.phone.trim()
      })
      toast.success('Profile updated successfully')
      setEditing(false)
      setShowProfile(false)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-dark-bg' : 'bg-slate-50'}`}>

      {/* Sticky Header */}
      <header className={`flex-shrink-0 sticky top-0 z-50 border-b ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="px-4 h-14 flex items-center justify-between max-w-2xl mx-auto w-full">
          {showBackButton ? (
            // Header with back button for sub pages
            <>
              <button
                onClick={() => navigate('/technician')}
                className={`p-1.5 rounded-lg transition ${
                  isDark
                    ? 'hover:bg-white/10 text-white'
                    : 'hover:bg-gray-100 text-gray-900'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className={`font-black text-base tracking-tight absolute left-1/2 -translate-x-1/2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Friends Aqua Care
              </span>
              <div className="w-9"></div>
            </>
          ) : (
            // Home page header with logo, centered title, and profile
            <>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-lg">F</span>
              </div>
              <span className={`font-black text-base tracking-tight absolute left-1/2 -translate-x-1/2 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Friends Aqua Care
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowAvatarMenu(!showAvatarMenu)
                }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm bg-cyan-500 flex-shrink-0 hover:ring-2 hover:ring-cyan-400 transition relative"
              >
                {getInitials(profile?.name)}
              </button>

              {/* Avatar Dropdown Menu */}
              <AnimatePresence>
                {showAvatarMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setShowAvatarMenu(false)}
                      className="fixed inset-0 z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className={`absolute right-4 top-16 w-56 rounded-xl shadow-xl border overflow-hidden z-50 ${
                        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
                      }`}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          openProfile()
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors flex items-center gap-3 ${
                          isDark ? 'text-white hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">👤</span>
                        View Profile
                      </button>
                      <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAvatarMenu(false)
                          setShowSettings(true)
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors flex items-center gap-3 ${
                          isDark ? 'text-white hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="text-lg">⚙️</span>
                        Settings
                      </button>
                      <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowAvatarMenu(false)
                          handleLogout()
                        }}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <span className="text-lg">🚪</span>
                        Logout
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="w-full max-w-2xl mx-auto px-4 py-4 pb-10">
          {children}
        </div>
      </main>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${
            isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${
              isDark
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-white/10'
                : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-gray-100'
            }`}>
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                ⚙️ Settings
              </h3>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Theme Toggle */}
              <div>
                <label className={`text-xs font-bold uppercase tracking-wider block mb-3 ${
                  isDark ? 'text-white/60' : 'text-gray-500'
                }`}>
                  🎨 Theme
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => isDark && toggleTheme()}
                    className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all border-2 ${
                      !isDark
                        ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-amber-500 shadow-lg'
                        : isDark
                        ? 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'
                        : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">☀️</span>
                      <span>Light</span>
                    </div>
                  </button>
                  <button
                    onClick={() => !isDark && toggleTheme()}
                    className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all border-2 ${
                      isDark
                        ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-500 shadow-lg'
                        : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-2xl">🌙</span>
                      <span>Dark</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />

              {/* App Info */}
              <div className="text-center py-4">
                <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-white font-black text-3xl bg-gradient-to-br from-cyan-400 to-blue-500 mb-4">
                  <span className="text-4xl">⚙️</span>
                </div>
                <h4 className={`font-bold text-lg mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Friends Aqua Care
                </h4>
                <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                  Technician Portal
                </p>
                <div className={`mt-4 inline-block px-4 py-2 rounded-full text-xs font-bold ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                }`}>
                  Version 1.0.0
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'
            }`}>
              <button
                onClick={() => setShowSettings(false)}
                className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${
                  isDark
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${
            isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`px-6 py-4 border-b ${
              isDark
                ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-white/10'
                : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-gray-100'
            }`}>
              <div className="flex items-center justify-between">
                <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  👤 My Profile
                </h3>
                {!editing && (
                  <button
                    onClick={() => setEditing(true)}
                    className={`text-sm font-bold px-3 py-1.5 rounded-lg transition ${
                      isDark
                        ? 'bg-white/10 text-white hover:bg-white/20'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ✏️ Edit
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              {/* Profile Avatar */}
              <div className="flex justify-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl bg-gradient-to-br from-cyan-400 to-blue-500">
                  {profile?.name?.[0]?.toUpperCase() || 'T'}
                </div>
              </div>

              {/* Role Badge */}
              <div className="text-center">
                <span className={`inline-block text-xs font-bold px-3 py-1.5 rounded-full ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
                }`}>
                  🔧 Technician
                </span>
              </div>

              {/* Form Fields */}
              <div className="space-y-3">
                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                    isDark ? 'text-white/60' : 'text-gray-500'
                  }`}>
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    disabled={!editing}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-cyan-300'
                    } disabled:opacity-60`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                    isDark ? 'text-white/60' : 'text-gray-500'
                  }`}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!editing}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-cyan-300'
                    } disabled:opacity-60`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-bold uppercase tracking-wider block mb-2 ${
                    isDark ? 'text-white/60' : 'text-gray-500'
                  }`}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    disabled
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white/40'
                        : 'bg-gray-100 border-gray-200 text-gray-500'
                    } cursor-not-allowed`}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 border-t flex gap-3 ${
              isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'
            }`}>
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      setEditing(false)
                      setFormData({
                        name: profile?.name || '',
                        phone: profile?.phone || profile?.phoneNumber || '',
                        email: profile?.email || ''
                      })
                    }}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                      isDark
                        ? 'bg-white/5 text-white/60 hover:bg-white/10'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold transition bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
                  >
                    💾 Save Changes
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowProfile(false)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${
                    isDark
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

TechnicianLayout.propTypes = {
  children: PropTypes.node.isRequired,
  navItems: PropTypes.array,
}
