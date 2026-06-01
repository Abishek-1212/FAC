import { Routes, Route, Navigate } from 'react-router-dom'
import Lottie from 'lottie-react'
import loadingAnimation from './Assets/blueLoading.json'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import CompleteProfile from './pages/CompleteProfile'
import AdminDashboard from './pages/AdminDashboard'
import InventoryDashboard from './pages/InventoryDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'
import CustomerDashboard from './pages/CustomerDashboard'
import PropTypes from 'prop-types'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-aqua-50">
      <Lottie animationData={loadingAnimation} loop style={{ width: 250, height: 250 }} />
    </div>
  )
}

function WaitingApprovalScreen() {
  const { logout } = useAuth()
  const handleLogout = async () => { await logout(); window.location.href = '/login' }
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      <div className="bg-white rounded-3xl shadow-xl p-8 max-w-sm w-full text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto text-4xl">⏳</div>
        <div>
          <h1 className="text-2xl font-black text-gray-900">Waiting for Approval</h1>
          <p className="text-gray-500 text-sm mt-2">Your account is pending admin approval. Please wait until the admin activates your account.</p>
        </div>
        <button onClick={handleLogout} className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-xl transition">Logout</button>
      </div>
    </div>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading, isProfileComplete } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!profile) return <Navigate to="/login" replace />
  if (!isProfileComplete(profile)) return <Navigate to="/complete-profile" replace />
  if (allowedRoles && !allowedRoles.includes(profile.role)) return <Navigate to="/login" replace />
  if (profile.role === 'technician' && !profile.isApproved) return <WaitingApprovalScreen />
  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
  allowedRoles: PropTypes.arrayOf(PropTypes.string)
}

function RootRedirect() {
  const { user, profile, loading, isProfileComplete, ROLE_ROUTES } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user || !profile) return <Navigate to="/login" replace />
  if (!isProfileComplete(profile)) return <Navigate to="/complete-profile" replace />
  if (profile.role === 'technician' && !profile.isApproved) return <WaitingApprovalScreen />
  return <Navigate to={ROLE_ROUTES[profile.role] || '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/complete-profile" element={<CompleteProfile />} />
      <Route path="/" element={<RootRedirect />} />
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/inventory/*" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <InventoryDashboard />
        </ProtectedRoute>
      } />
      <Route path="/technician/*" element={
        <ProtectedRoute allowedRoles={['technician']}>
          <TechnicianDashboard />
        </ProtectedRoute>
      } />
      <Route path="/customer/*" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <CustomerDashboard />
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
