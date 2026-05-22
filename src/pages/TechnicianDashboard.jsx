import { Routes, Route, Navigate } from 'react-router-dom'
import TechnicianLayout from '../components/common/TechnicianLayout'
import TechnicianHome from '../components/technician/TechnicianHome'
import JobDetail from '../components/technician/JobDetail'
import MyStock from '../components/technician/MyStock'
import TakeStock from '../components/technician/TakeStock'
import ReturnStock from '../components/technician/ReturnStock'
import ViewInvoices from '../components/technician/ViewInvoices'
import CompletionReports from '../components/technician/CompletionReports'

const NAV = [
  { to: '/technician', icon: '\u{1F527}', label: 'My Jobs' },
  { to: '/technician/reports', icon: '\u{1F4CB}', label: 'Reports' },
  { to: '/technician/stock', icon: '\u{1F4E6}', label: 'My Stock' },
  { to: '/technician/my-invoices', icon: '\u{1F4D1}', label: 'My Invoices' },
]

export default function TechnicianDashboard() {
  return (
    <TechnicianLayout navItems={NAV}>
      <Routes>
        <Route index element={<TechnicianHome />} />
        <Route path="job/:jobId" element={<JobDetail />} />
        <Route path="reports" element={<CompletionReports />} />
        <Route path="stock" element={<MyStock />} />
        <Route path="take-stock" element={<TakeStock />} />
        <Route path="return-stock" element={<ReturnStock />} />
        <Route path="my-invoices" element={<ViewInvoices />} />
        <Route path="*" element={<Navigate to="/technician" replace />} />
      </Routes>
    </TechnicianLayout>
  )
}
