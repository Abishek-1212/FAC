import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/common/Layout'
import AdminHome from '../components/admin/AdminHome'
import Products from '../components/admin/Products'
import Employees from '../components/admin/Employees'
import ServiceJobs from '../components/admin/ServiceJobs'
import Invoices from '../components/admin/Invoices'
import Reports from '../components/admin/Reports'
import Inventory from '../components/admin/Inventory'
import VerifyStock from '../components/admin/VerifyStock'
import FollowUpService from '../components/admin/FollowUpService'

const NAV = [
  { to: '/admin', icon: '🏠', label: 'Dashboard' },
  { to: '/admin/jobs', icon: '🔧', label: 'Service Jobs' },
  { to: '/admin/products', icon: '📦', label: 'Products' },
  { to: '/admin/inventory', icon: '🏪', label: 'Inventory' },
  { to: '/admin/employees', icon: '👷', label: 'Technicians' },
  { to: '/admin/invoices', icon: '🧾', label: 'Invoices' },
  { to: '/admin/reports', icon: '📈', label: 'Reports' },
]

export default function AdminDashboard() {
  return (
    <Layout navItems={NAV} title="Admin">
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="jobs" element={<ServiceJobs />} />
        <Route path="follow-up" element={<FollowUpService />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="employees" element={<Employees />} />
        <Route path="invoices" element={<Invoices />} />
        <Route path="reports" element={<Reports />} />
        <Route path="verify-stock" element={<VerifyStock />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Layout>
  )
}
