import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'

function DonutChart({ segments, size = 140, thickness = 24, label, sub }) {
  const r = (size - thickness) / 2
  const circ = 2 * Math.PI * r
  const cx = size / 2, cy = size / 2
  const total = segments.reduce((s, x) => s + x.value, 0)
  let offset = 0
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {total === 0 ? (
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e5e7eb" strokeWidth={thickness} />
          ) : (
            segments.map((seg, i) => {
              const pct = seg.value / total
              const dash = pct * circ
              const el = (
                <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                  stroke={seg.color} strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circ - dash}`}
                  strokeDashoffset={-offset * circ + circ * 0.25}
                  strokeLinecap="butt"
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              )
              offset += pct
              return el
            })
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-black text-gray-900 leading-none">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-gray-500 whitespace-nowrap">{s.label}: {s.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Reports() {
  const { isDark } = useTheme()
  const [jobs, setJobs] = useState([])
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), s =>
      setJobs(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    const u2 = onSnapshot(collection(db, 'invoices'), s =>
      setInvoices(s.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2() }
  }, [])

  // Jobs stats
  const totalJobs = jobs.length
  const completedJobs = jobs.filter(j => ['completed', 'verified'].includes(j.status)).length
  const pendingJobs = jobs.filter(j => j.status === 'pending').length
  const assignedJobs = jobs.filter(j => j.status === 'assigned').length
  const inProgressJobs = jobs.filter(j => j.status === 'in_progress').length
  const completionRate = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0

  // Revenue stats
  const totalBilled = invoices.reduce((s, i) => s + (i.billAmount || 0), 0)
  const totalReceived = invoices.reduce((s, i) => s + (i.amountReceived || 0), 0)
  const totalPending = invoices.reduce((s, i) => s + (i.paymentPending || 0), 0)
  const collectionRate = totalBilled > 0 ? Math.round((totalReceived / totalBilled) * 100) : 0

  // Service type
  const newFitting = jobs.filter(j => j.serviceType === 'New Fitting').length
  const serviceRepair = jobs.filter(j => j.serviceType === 'Service / Repair').length

  // Technician performance — evaluate based on services, consistency, perfection
  const techMap = {}
  jobs.forEach(j => {
    if (!j.technicianName) return
    const n = j.technicianName
    if (!techMap[n]) techMap[n] = { total: 0, completed: 0, inProgress: 0, pending: 0 }
    techMap[n].total++
    if (['completed', 'verified'].includes(j.status)) techMap[n].completed++
    else if (j.status === 'in_progress') techMap[n].inProgress++
    else techMap[n].pending++
  })

  const techList = Object.entries(techMap)
    .map(([name, v]) => {
      const completionRate = v.total > 0 ? Math.round((v.completed / v.total) * 100) : 0
      // Consistency: how regularly they complete (penalise pending)
      const consistencyRate = v.total > 0 ? Math.round(((v.completed + v.inProgress) / v.total) * 100) : 0
      // Perfection: only fully completed jobs
      const perfectionRate = completionRate
      const overallScore = Math.round((completionRate * 0.5) + (consistencyRate * 0.3) + (perfectionRate * 0.2))
      return { name, ...v, completionRate, consistencyRate, perfectionRate, overallScore }
    })
    .sort((a, b) => b.total - a.total)

  const card = `rounded-2xl border ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`
  const t = isDark ? 'text-white' : 'text-gray-900'
  const s = isDark ? 'text-white/40' : 'text-gray-400'

  const StatBox = ({ label, value, color }) => (
    <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
      <p className={`text-xs font-semibold mb-1 ${s}`}>{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}</p>
    </div>
  )

  const RateBar = ({ label, value, color }) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{label}</span>
        <span className={`text-xs font-black ${color}`}>{value}%</span>
      </div>
      <div className={`w-full h-2 rounded-full ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color.includes('green') ? '#10b981' : color.includes('blue') ? '#3b82f6' : color.includes('purple') ? '#8b5cf6' : '#f59e0b' }}
        />
      </div>
    </div>
  )

  return (
    <div className="space-y-6 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => window.history.back()} className={`p-2 rounded-xl border transition ${isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 shadow-sm'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
        <div>
          <h2 className={`text-2xl font-black ${t}`}>Reports & Analytics</h2>
          <p className={`text-sm mt-0.5 ${s}`}>{totalJobs} total jobs · {invoices.length} invoices</p>
        </div>
      </div>

      {/* Jobs + Revenue side by side on desktop */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Jobs Donut */}
        <div className={`${card} p-5`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${s}`}>SERVICE JOBS</p>
          <div className="flex justify-center">
            <DonutChart
              label={totalJobs}
              sub="jobs"
              segments={[
                { label: 'Pending', value: pendingJobs, color: '#f59e0b' },
                { label: 'Assigned', value: assignedJobs, color: '#3b82f6' },
                { label: 'In Progress', value: inProgressJobs, color: '#8b5cf6' },
                { label: 'Completed', value: completedJobs, color: '#10b981' },
              ]}
            />
          </div>
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'} flex justify-between items-center`}>
            <span className={`text-sm ${s}`}>Completion Rate</span>
            <span className={`text-lg font-black ${completionRate >= 70 ? 'text-green-500' : 'text-amber-500'}`}>{completionRate}%</span>
          </div>
        </div>

        {/* Revenue Donut */}
        <div className={`${card} p-5`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${s}`}>REVENUE</p>
          <div className="flex justify-center">
            <DonutChart
              label={`₹${totalBilled >= 1000 ? (totalBilled / 1000).toFixed(1) + 'k' : totalBilled}`}
              sub="billed"
              segments={[
                { label: 'Collected', value: totalReceived, color: '#10b981' },
                { label: 'Pending', value: totalPending, color: '#ef4444' },
              ]}
            />
          </div>
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'} flex justify-between items-center`}>
            <span className={`text-sm ${s}`}>Collection Rate</span>
            <span className={`text-lg font-black ${collectionRate >= 70 ? 'text-green-500' : 'text-amber-500'}`}>{collectionRate}%</span>
          </div>
        </div>
      </div>

      {/* Service Type */}
      <div className={`${card} p-5`}>
        <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${s}`}>SERVICE TYPE BREAKDOWN</p>
        <div className="grid grid-cols-2 gap-4">
          <StatBox
            label="New Fitting"
            value={newFitting}
            color="text-blue-500"
          />
          <StatBox
            label="Service / Repair"
            value={serviceRepair}
            color="text-orange-500"
          />
        </div>
        {totalJobs > 0 && (
          <div className={`mt-4 pt-4 border-t ${isDark ? 'border-white/10' : 'border-gray-100'}`}>
            <div className={`w-full h-3 rounded-full overflow-hidden ${isDark ? 'bg-white/10' : 'bg-gray-100'}`}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(newFitting / totalJobs) * 100}%` }}
                transition={{ duration: 0.7 }}
                className="h-full bg-blue-500 rounded-full"
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className={`text-xs ${s}`}>New Fitting {Math.round((newFitting / totalJobs) * 100)}%</span>
              <span className={`text-xs ${s}`}>Service {Math.round((serviceRepair / totalJobs) * 100)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Technician Performance */}
      {techList.length > 0 && (
        <div className={`${card} p-5`}>
          <p className={`text-xs font-bold uppercase tracking-widest mb-4 ${s}`}>TECHNICIAN PERFORMANCE</p>
          <div className="space-y-5">
            {techList.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className={`p-4 rounded-xl ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}
              >
                {/* Name + Score */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-base font-black flex-shrink-0 ${
                      isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-500 text-white'
                    }`}>
                      {tech.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className={`font-black text-sm ${t}`}>{tech.name}</p>
                      <p className={`text-xs ${s}`}>{tech.total} services total</p>
                    </div>
                  </div>
                  <div className={`text-center px-3 py-1.5 rounded-xl ${
                    tech.overallScore >= 80 ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700' :
                    tech.overallScore >= 60 ? isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700' :
                    isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                  }`}>
                    <p className="text-lg font-black leading-none">{tech.overallScore}%</p>
                    <p className="text-[10px] font-semibold opacity-70">Score</p>
                  </div>
                </div>

                {/* 3 Rate Bars */}
                <div className="space-y-2">
                  <RateBar label="Completion" value={tech.completionRate} color="text-green-500" />
                  <RateBar label="Consistency" value={tech.consistencyRate} color="text-blue-500" />
                  <RateBar label="Perfection" value={tech.perfectionRate} color="text-purple-500" />
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-2 mt-3">
                  <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                    <p className={`text-base font-black ${isDark ? 'text-green-300' : 'text-green-600'}`}>{tech.completed}</p>
                    <p className={`text-[10px] font-semibold ${isDark ? 'text-green-300/60' : 'text-green-600/60'}`}>Completed</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                    <p className={`text-base font-black ${isDark ? 'text-purple-300' : 'text-purple-600'}`}>{tech.inProgress}</p>
                    <p className={`text-[10px] font-semibold ${isDark ? 'text-purple-300/60' : 'text-purple-600/60'}`}>In Progress</p>
                  </div>
                  <div className={`text-center p-2 rounded-lg ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                    <p className={`text-base font-black ${isDark ? 'text-amber-300' : 'text-amber-600'}`}>{tech.pending}</p>
                    <p className={`text-[10px] font-semibold ${isDark ? 'text-amber-300/60' : 'text-amber-600/60'}`}>Pending</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
