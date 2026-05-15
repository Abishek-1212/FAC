import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { motion } from 'framer-motion'

export default function Login() {
  const { loginWithEmail, loginWithGoogle, isProfileComplete, ROLE_ROUTES } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const redirectUser = (profile) => {
    if (!isProfileComplete(profile)) return navigate('/complete-profile', { replace: true })
    navigate(ROLE_ROUTES[profile?.role] || '/customer', { replace: true })
  }

  const handleEmailLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { profile } = await loginWithEmail(email, password)
      redirectUser(profile)
    } catch (err) {
      const msg = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password'
        ? 'Invalid email or password'
        : err.code === 'auth/too-many-requests'
        ? 'Too many attempts. Try again later.'
        : 'Login failed. Please try again.'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setGoogleLoading(true)
    try {
      const result = await loginWithGoogle()
      if (!result) return // popup closed
      if (result.isNew) {
        navigate('/complete-profile', {
          replace: true,
          state: { email: result.cred.user.email, uid: result.cred.user.uid, fromGoogle: true },
        })
      } else {
        redirectUser(result.profile)
      }
    } catch (err) {
      toast.error('Google login failed. Please try again.')
    } finally {
      setGoogleLoading(false)
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
            <span className="text-3xl">💧</span>
          </div>
          <h1 className="text-2xl font-black text-gray-800">Friends Aqua Care</h1>
          <p className="text-gray-500 text-sm mt-1">Service Management System</p>
        </div>

        <form onSubmit={handleEmailLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full mt-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-400 bg-gray-50"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Password</label>
            <div className="relative mt-1">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
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
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-aqua-500 hover:bg-aqua-600 text-white font-bold py-3.5 rounded-xl transition disabled:opacity-60"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition disabled:opacity-60"
        >
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.1 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.1-2.7-.1-4z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.5 15.1 18.9 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.1 6.5 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5l-6.2-5.2C29.4 35.6 26.8 36 24 36c-5.2 0-9.6-2.9-11.3-7.1l-6.6 5.1C9.6 39.6 16.3 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.8l6.2 5.2C40.8 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-4z"/>
          </svg>
          {googleLoading ? 'Connecting...' : 'Continue with Google'}
        </button>

        <p className="text-center text-xs text-gray-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-aqua-600 font-semibold hover:underline">Create one</Link>
        </p>
      </motion.div>
    </div>
  )
}
