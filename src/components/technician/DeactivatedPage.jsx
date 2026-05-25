import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function DeactivatedPage() {
  const { logout } = useAuth()
  const { isDark } = useTheme()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className={`h-screen flex flex-col ${isDark ? 'bg-dark-bg' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`flex-shrink-0 border-b ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="px-4 h-14 flex items-center justify-between max-w-2xl mx-auto w-full">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-lg">F</span>
          </div>
          <span className={`font-black text-base tracking-tight absolute left-1/2 -translate-x-1/2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Friends Aqua Care
          </span>
          <button
            onClick={handleLogout}
            className="text-sm font-bold px-3 py-1.5 rounded-lg transition bg-red-500 text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="text-center space-y-6 max-w-md">
          <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto text-5xl ${isDark ? 'bg-red-500/20' : 'bg-red-100'}`}>
            🔒
          </div>
          <div>
            <h1 className={`text-3xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
              Account Temporarily Inactive
            </h1>
            <p className={`text-lg mb-4 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              Your account has been deactivated by the administrator.
            </p>
            <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
              Please contact your administrator for more information or to reactivate your account.
            </p>
          </div>
          <div className={`rounded-2xl p-6 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
            <p className={`text-sm font-semibold mb-3 ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
              Account Status
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className={`font-bold ${isDark ? 'text-red-400' : 'text-red-600'}`}>
                Inactive
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
