import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/common/Layout'
import StockDashboard from '../components/inventory/StockDashboard'
import ReceiveStock from '../components/inventory/ReceiveStock'
import AssignStock from '../components/inventory/AssignStock'
import VerifyReturn from '../components/inventory/VerifyReturn'

const NAV = [
  { to: '/inventory', icon: '📊', label: 'Dashboard' },
  { to: '/inventory/receive', icon: '📥', label: 'Receive Stock' },
  { to: '/inventory/assign', icon: '📤', label: 'Assign Stock' },
  { to: '/inventory/returns', icon: '↩️', label: 'Verify Returns' },
]

export default function InventoryDashboard() {
  return (
    <Layout navItems={NAV} title="Inventory">
      <Routes>
        <Route index element={<StockDashboard />} />
        <Route path="receive" element={<ReceiveStock />} />
        <Route path="assign" element={<AssignStock />} />
        <Route path="returns" element={<VerifyReturn />} />
        <Route path="*" element={<Navigate to="/inventory" replace />} />
      </Routes>
    </Layout>
  )
}
