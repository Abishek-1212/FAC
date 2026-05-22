import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import PropTypes from 'prop-types'

export default function TechnicianLayout({ children }) {
  const { profile } = useAuth()
  const { isDark } = useTheme()

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDark ? 'bg-dark-bg' : 'bg-slate-50'}`}>

      {/* Sticky Header */}
      <header className={`flex-shrink-0 sticky top-0 z-50 border-b ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'} shadow-sm`}>
        <div className="px-4 h-14 flex items-center justify-between max-w-2xl mx-auto w-full">
          <span className={`font-black text-base tracking-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Friends Aqua Care
          </span>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm bg-cyan-500 flex-shrink-0">
              {profile?.name?.[0]?.toUpperCase() || 'T'}
            </div>
            <div>
              <p className={`text-xs font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'}`}>{profile?.name}</p>
              <p className={`text-[10px] leading-tight ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>Technician</p>
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="w-full max-w-2xl mx-auto px-4 py-4 pb-10">
          {children}
        </div>
      </main>

    </div>
  )
}

TechnicianLayout.propTypes = {
  children: PropTypes.node.isRequired,
  navItems: PropTypes.array,
}
