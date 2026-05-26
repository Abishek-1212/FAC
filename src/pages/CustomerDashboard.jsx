import Layout from '../components/common/Layout'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

const NAV = []

export default function CustomerDashboard() {
  const { profile } = useAuth()
  const { isDark } = useTheme()

  return (
    <Layout navItems={NAV} title="Pending">
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className={`rounded-3xl p-10 max-w-sm w-full text-center shadow-xl border ${
          isDark ? 'bg-dark-card border-dark-border' : 'bg-white border-light-border'
        }`}>
          <div className="text-5xl mb-5">⏳</div>
          <h2 className={`text-xl font-black mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>
            Account Pending Approval
          </h2>
          <p className={`text-sm leading-relaxed ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
            Hi <span className={`font-bold ${isDark ? 'text-cyan-400' : 'text-cyan-600'}`}>{profile?.name}</span>, your account is awaiting assignment.<br />
            Please wait for the admin to assign you as a technician.
          </p>
        </div>
      </div>
    </Layout>
  )
}
