import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate, useLocation } from 'react-router-dom'
import { useState } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import toast from 'react-hot-toast'
import PropTypes from 'prop-types'

export default function TechnicianLayout({ children }) {
  const { profile } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [showProfile, setShowProfile] = useState(false)
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
                onClick={openProfile}
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm bg-cyan-500 flex-shrink-0 hover:ring-2 hover:ring-cyan-400 transition"
              >
                {profile?.name?.[0]?.toUpperCase() || 'T'}
              </button>
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
