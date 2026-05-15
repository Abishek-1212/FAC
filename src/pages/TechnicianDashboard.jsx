import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '../components/common/Layout'
import TechnicianHome from '../components/technician/TechnicianHome'
import JobDetail from '../components/technician/JobDetail'
import MyStock from '../components/technician/MyStock'

const NAV = [
  { to: '/technician', icon: '🔧', label: 'My Jobs' },
  { to: '/technician/stock', icon: '📦', label: 'My Stock' },
]

export default function TechnicianDashboard() {
  return (
    <Layout navItems={NAV} title="Technician">
      <Routes>
        <Route index element={<TechnicianHome />} />
        <Route path="job/:jobId" element={<JobDetail />} />
        <Route path="stock" element={<MyStock />} />
        <Route path="*" element={<Navigate to="/technician" replace />} />
      </Routes>
    </Layout>
  )
}
