import logoImg from '../../Assets/logo.png'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useRef } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'
import PropTypes from 'prop-types'
import { motion, AnimatePresence } from 'framer-motion'
import DeactivatedPage from '../technician/DeactivatedPage'

const CLOUDINARY_CLOUD = 'denkbc0ls'
const CLOUDINARY_PRESET = 'Friends Aqua Care'

export default function TechnicianLayout({ children }) {
  const { profile, logout, fetchProfile } = useAuth()
  const { isDark, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfile, setShowProfile] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const [editing, setEditing] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({ name: '', phone: '', email: '' })
  const fileInputRef = useRef(null)

  const showBackButton = [
    '/technician/reports',
    '/technician/stock',
    '/technician/my-invoices',
    '/technician/take-stock',
    '/technician/return-stock',
    '/technician/attendance'
  ].includes(location.pathname)

  const isDeactivated = profile?.isActive === false
  if (isDeactivated) return <DeactivatedPage />

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

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    try {
      const data = new FormData()
      data.append('file', file)
      data.append('upload_preset', CLOUDINARY_PRESET)
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
        method: 'POST',
        body: data
      })
      const json = await res.json()
      if (!json.secure_url) throw new Error('Upload failed')
      await updateDoc(doc(db, 'users', profile.uid), { photoURL: json.secure_url })
      await fetchProfile(profile.uid)
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
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
        <div className="px-4 h-16 flex items-center justify-between max-w-2xl mx-auto w-full">
          {showBackButton ? (
            <>
              <button
                onClick={() => navigate('/technician')}
                className={`p-1.5 rounded-lg transition ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-100 text-gray-900'}`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className={`font-black text-base tracking-tight absolute left-1/2 -translate-x-1/2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Friends Aqua Care
              </span>
              <div className="w-9" />
            </>
          ) : (
            <>
              <motion.img
                src={logoImg}
                alt="logo"
                className="w-14 h-14 object-contain flex-shrink-0"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
              <span className={`font-black text-base tracking-tight absolute left-1/2 -translate-x-1/2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                Friends Aqua Care
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(!showAvatarMenu) }}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0 hover:ring-2 hover:ring-cyan-400 transition relative overflow-hidden bg-cyan-500"
              >
                {profile?.photoURL
                  ? <img src={profile.photoURL} alt="avatar" className="w-full h-full object-cover" />
                  : getInitials(profile?.name)
                }
              </button>

              <AnimatePresence>
                {showAvatarMenu && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setShowAvatarMenu(false)}
                      className="fixed inset-0 z-40"
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className={`absolute right-4 top-16 w-52 rounded-xl shadow-xl border overflow-hidden z-50 ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'}`}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); openProfile() }}
                        className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors flex items-center gap-3 ${isDark ? 'text-white hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        View Profile
                      </button>
                      <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); setShowSettings(true) }}
                        className={`w-full px-4 py-3 text-left text-sm font-semibold transition-colors flex items-center gap-3 ${isDark ? 'text-white hover:bg-white/5' : 'text-gray-700 hover:bg-gray-50'}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Settings
                      </button>
                      <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-100'}`} />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowAvatarMenu(false); handleLogout() }}
                        className="w-full px-4 py-3 text-left text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-3"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
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
          <div className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${isDark ? 'bg-dark-card border border-white/10' : 'bg-white'}`}>
            <div className={`px-6 py-4 border-b ${isDark ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-white/10' : 'bg-gradient-to-r from-cyan-50 to-blue-50 border-gray-100'}`}>
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>Settings</h3>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <label className={`text-xs font-bold uppercase tracking-wider block mb-3 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                  Theme
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => isDark && toggleTheme()}
                    className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all border-2 ${!isDark ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white border-amber-500 shadow-lg' : 'bg-white/5 text-white/40 border-white/10 hover:bg-white/10'}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                      </svg>
                      <span>Light</span>
                    </div>
                  </button>
                  <button
                    onClick={() => !isDark && toggleTheme()}
                    className={`flex-1 rounded-xl py-3 px-4 text-sm font-bold transition-all border-2 ${isDark ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-indigo-500 shadow-lg' : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'}`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                      </svg>
                      <span>Dark</span>
                    </div>
                  </button>
                </div>
              </div>
              <div className={`h-px ${isDark ? 'bg-white/10' : 'bg-gray-200'}`} />
              <div className="text-center py-2">
                <h4 className={`font-bold text-base mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Friends Aqua Care</h4>
                <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Technician Portal · v1.0.0</p>
              </div>
            </div>
            <div className={`px-6 py-4 border-t ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
              <button
                onClick={() => setShowSettings(false)}
                className={`w-full rounded-xl py-2.5 text-sm font-bold transition ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
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
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`rounded-2xl shadow-2xl max-w-md w-full overflow-hidden ${isDark ? 'bg-dark-card border border-white/10' : 'bg-white'}`}
          >
            {/* Banner + Avatar */}
            <div className={`relative h-24 bg-gradient-to-r from-cyan-500 to-blue-600`}>
              <button
                onClick={() => setShowProfile(false)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition"
              >
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              {!editing && (
                <button
                  onClick={() => setEditing(true)}
                  className="absolute top-3 left-3 px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-semibold transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
                  </svg>
                  Edit
                </button>
              )}
            </div>

            {/* Avatar */}
            <div className="flex justify-center -mt-12 mb-3 relative z-10">
              <div className="relative">
                <div className="w-24 h-24 rounded-full border-4 border-white dark:border-dark-card overflow-hidden bg-cyan-500 flex items-center justify-center shadow-lg">
                  {profile?.photoURL
                    ? <img src={profile.photoURL} alt="avatar" className="w-full h-full object-cover" />
                    : <span className="text-white font-black text-3xl">{getInitials(profile?.name)}</span>
                  }
                </div>
                {editing && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-cyan-500 hover:bg-cyan-600 border-2 border-white flex items-center justify-center shadow-md transition"
                    >
                      {uploading
                        ? <svg className="w-4 h-4 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                        : <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                      }
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </>
                )}
              </div>
            </div>

            {/* Name & Role */}
            <div className="text-center px-6 mb-5">
              <h3 className={`font-black text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name || 'Technician'}</h3>
              <span className={`inline-block mt-1 text-xs font-semibold px-3 py-1 rounded-full ${isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'}`}>
                Technician
              </span>
            </div>

            {/* Form Fields */}
            <div className="px-6 pb-2 space-y-3">
              {[
                { label: 'Full Name', key: 'name', type: 'text', editable: true },
                { label: 'Phone', key: 'phone', type: 'tel', editable: true },
                { label: 'Email', key: 'email', type: 'email', editable: false },
              ].map(({ label, key, type, editable }) => (
                <div key={key}>
                  <label className={`text-xs font-semibold uppercase tracking-wider block mb-1.5 ${isDark ? 'text-white/50' : 'text-gray-400'}`}>
                    {label}
                  </label>
                  <input
                    type={type}
                    value={formData[key]}
                    onChange={e => setFormData({ ...formData, [key]: e.target.value })}
                    disabled={!editing || !editable}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition ${
                      isDark
                        ? 'bg-white/5 border-white/10 text-white focus:ring-cyan-500'
                        : 'bg-white border-gray-200 text-gray-900 focus:ring-cyan-300'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className={`px-6 py-4 mt-4 border-t flex gap-3 ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
              {editing ? (
                <>
                  <button
                    onClick={() => { setEditing(false); setFormData({ name: profile?.name || '', phone: profile?.phone || profile?.phoneNumber || '', email: profile?.email || '' }) }}
                    className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold transition bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600"
                  >
                    Save Changes
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowProfile(false)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition ${isDark ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}

    </div>
  )
}

TechnicianLayout.propTypes = {
  children: PropTypes.node.isRequired,
  navItems: PropTypes.array,
}
