import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Register from './pages/Register'
import CompleteProfile from './pages/CompleteProfile'
import AdminDashboard from './pages/AdminDashboard'
import InventoryDashboard from './pages/InventoryDashboard'
import TechnicianDashboard from './pages/TechnicianDashboard'
import CustomerDashboard from './pages/CustomerDashboard'

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-aqua-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-aqua-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-aqua-700 font-medium">Loading...</p>
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
  return children
}

function RootRedirect() {
  const { user, profile, loading, isProfileComplete, ROLE_ROUTES } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user || !profile) return <Navigate to="/login" replace />
  if (!isProfileComplete(profile)) return <Navigate to="/complete-profile" replace />
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
        <ProtectedRoute allowedRoles={['inventory_manager', 'admin']}>
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
