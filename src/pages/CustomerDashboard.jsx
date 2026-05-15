import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/common/Layout'
import CustomerHome from '../components/customer/CustomerHome'
import CustomerInvoices from '../components/customer/CustomerInvoices'

const NAV = [
  { to: '/customer', icon: '🏠', label: 'Home' },
  { to: '/customer/invoices', icon: '🧾', label: 'Invoices' },
]

export default function CustomerDashboard() {
  return (
    <Layout navItems={NAV} title="Customer">
      <Routes>
        <Route index element={<CustomerHome />} />
        <Route path="invoices" element={<CustomerInvoices />} />
        <Route path="*" element={<Navigate to="/customer" replace />} />
      </Routes>
    </Layout>
  )
}
