import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

const STATUS_META_LIGHT = {
  pending:     { color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-400',  label: 'Pending' },
  assigned:    { color: 'bg-blue-100 text-blue-700 border-blue-200',      dot: 'bg-blue-400',   label: 'Assigned' },
  in_progress: { color: 'bg-violet-100 text-violet-700 border-violet-200',dot: 'bg-violet-400', label: 'In Progress' },
  completed:   { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', label: 'Completed' },
  cancelled:   { color: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-400',    label: 'Cancelled' },
}

const STATUS_META_DARK = {
  pending:     { color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',   dot: 'bg-amber-400',  label: 'Pending' },
  assigned:    { color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',      dot: 'bg-blue-400',   label: 'Assigned' },
  in_progress: { color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',dot: 'bg-violet-400', label: 'In Progress' },
  completed:   { color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400', label: 'Completed' },
  cancelled:   { color: 'bg-red-500/20 text-red-300 border-red-500/30',         dot: 'bg-red-400',    label: 'Cancelled' },
}

const SERVICE_TYPES = ['New Fitting', 'Service / Repair']

const EMPTY_FORM = {
  customerName: '', customerPhone: '', customerAddress: '',
  problemDescription: '', componentName: '', serviceType: 'Service / Repair',
  technicianId: '', priority: 'normal',
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ServiceJobs() {
  const { isDark } = useTheme()
  const [jobs, setJobs]               = useState([])
  const [technicians, setTechnicians] = useState([])
  const [modal, setModal]             = useState(false)
  const [detailJob, setDetailJob]     = useState(null)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [filter, setFilter]           = useState('all')

  const STATUS_META = isDark ? STATUS_META_DARK : STATUS_META_LIGHT

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'service_jobs'), snap =>
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    )
    const u2 = onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap =>
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    )
    return () => { u1(); u2() }
  }, [])

  const handleCreate = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const techName = technicians.find(t => t.id === form.technicianId)?.name || ''
      await addDoc(collection(db, 'service_jobs'), {
        ...form,
        technicianName: techName,
        status: form.technicianId ? 'assigned' : 'pending',
        createdAt: serverTimestamp(),
      })
      toast.success('Job created!')
      setModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const filtered = filter === 'all'
    ? jobs
    : filter === 'pending'
    ? jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status))
    : jobs.filter(j => j.status === 'completed')

  const counts = {
    all: jobs.length,
    pending: jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status)).length,
    completed: jobs.filter(j => j.status === 'completed').length,
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className={`text-2xl font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Service Jobs</h2>
          <p className={`text-sm mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{jobs.length} total jobs</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setModal(true)}
          className={`px-5 py-2.5 rounded-2xl text-sm font-bold shadow-lg transition-shadow ${
            isDark 
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + New Job
        </motion.button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2">
        {[
          { key: 'all',       label: 'All',       count: counts.all },
          { key: 'pending',   label: 'Pending',   count: counts.pending },
          { key: 'completed', label: 'Completed', count: counts.completed },
        ].map(({ key, label, count }) => (
          <motion.button
            key={key}
            whileTap={{ scale: 0.95 }}
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl text-xs font-bold transition-all ${
              filter === key
                ? isDark
                  ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20'
                  : 'bg-aqua-500 text-white shadow-md shadow-aqua-200'
                : isDark
                ? 'bg-white/5 text-white/60 border border-white/10 hover:border-cyan-500/30'
                : 'bg-white text-gray-500 border border-gray-200 hover:border-aqua-300'
            }`}
          >
            {label}
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-black ${
              filter === key 
                ? 'bg-white/20 text-white' 
                : isDark ? 'bg-white/10 text-white/40' : 'bg-gray-100 text-gray-500'
            }`}>
              {count}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Job cards */}
      <AnimatePresence mode="popLayout">
        <div className="grid gap-3">
          {filtered.map((job, i) => {
            const meta = STATUS_META[job.status] || STATUS_META.pending
            return (
              <motion.div
                key={job.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                onClick={() => setDetailJob(job)}
                className={`rounded-2xl p-4 shadow-sm border cursor-pointer transition-all group ${
                  isDark 
                    ? 'bg-dark-card border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
                    : 'bg-white border-gray-100 hover:shadow-md hover:border-aqua-200'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  {/* Left */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.dot}`} />
                      <p className={`font-bold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{job.customerName}</p>
                      {job.priority === 'urgent' && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-600'
                        }`}>Urgent</span>
                      )}
                    </div>
                    <p className={`text-xs ml-4 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>📞 {job.customerPhone}</p>
                    {job.serviceType && (
                      <span className={`ml-4 mt-1.5 inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                        job.serviceType === 'New Fitting' 
                          ? isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-600'
                          : isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {job.serviceType === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service'}
                      </span>
                    )}
                    {job.componentName && (
                      <p className={`text-xs ml-4 mt-1 font-medium ${
                        isDark ? 'text-cyan-400' : 'text-aqua-600'
                      }`}>🔩 {job.componentName}</p>
                    )}
                    <p className={`text-xs ml-4 mt-1 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{formatDate(job.createdAt)}</p>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${meta.color}`}>
                      {meta.label}
                    </span>
                    {job.technicianName ? (
                      <p className={`text-xs font-medium ${isDark ? 'text-white/50' : 'text-gray-500'}`}>👷 {job.technicianName}</p>
                    ) : (
                      <p className={`text-xs italic ${isDark ? 'text-white/20' : 'text-gray-300'}`}>Unassigned</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )
          })}
          {filtered.length === 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              className={`rounded-2xl p-12 text-center border border-dashed ${
                isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              <p className="text-4xl mb-3">🔧</p>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>No jobs found</p>
            </motion.div>
          )}
        </div>
      </AnimatePresence>

      {/* Create Job Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Service Job" size="lg">
        <form onSubmit={handleCreate} className="space-y-3">
          {[
            ['customerName',    'Customer Name',    'text'],
            ['customerPhone',   'Phone Number',     'tel'],
            ['customerAddress', 'Address',          'text'],
            ['componentName',   'Component Name',   'text'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key !== 'componentName'}
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 bg-gray-50"
              />
            </div>
          ))}

          {/* Service Type */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Service Type</label>
            <div className="flex gap-2 mt-1">
              {SERVICE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, serviceType: t }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                    form.serviceType === t
                      ? 'border-aqua-500 bg-aqua-50 text-aqua-700'
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {t === 'New Fitting' ? '🔧 New Fitting' : '🛠️ Service / Repair'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Problem Description</label>
            <textarea
              value={form.problemDescription}
              onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))}
              required rows={2}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 resize-none bg-gray-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Technician</label>
              <select value={form.technicianId} onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 bg-gray-50">
                <option value="">Unassigned</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 bg-gray-50">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-aqua-500 to-aqua-600 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60 shadow-md shadow-aqua-200">
              {saving ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Job Detail Modal — read-only status (technician controls it) */}
      <Modal open={!!detailJob} onClose={() => setDetailJob(null)} title="Job Details" size="lg">
        {detailJob && (() => {
          const meta = STATUS_META[detailJob.status] || STATUS_META.pending
          return (
            <div className="space-y-4">
              {/* Status banner */}
              <div className={`rounded-2xl px-4 py-3 border flex items-center gap-3 ${meta.color}`}>
                <div className={`w-3 h-3 rounded-full ${meta.dot} animate-pulse`} />
                <div>
                  <p className="font-bold text-sm">{meta.label}</p>
                  <p className="text-xs opacity-70">Status is updated by the assigned technician</p>
                </div>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  ['👤 Customer',          detailJob.customerName],
                  ['📞 Phone',             detailJob.customerPhone],
                  ['📅 Date',              formatDate(detailJob.createdAt)],
                  ['👷 Technician',        detailJob.technicianName || 'Unassigned'],
                  ['🔩 Component',         detailJob.componentName || '—'],
                  ['⚡ Priority',          detailJob.priority === 'urgent' ? '🔴 Urgent' : '🟢 Normal'],
                ].map(([label, value]) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 font-semibold">{label}</p>
                    <p className="font-bold text-gray-800 text-sm mt-0.5">{value}</p>
                  </div>
                ))}
                <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-semibold">📍 Address</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{detailJob.customerAddress}</p>
                </div>
                {detailJob.serviceType && (
                  <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 font-semibold">🛠️ Service Type</p>
                    <p className="font-bold text-gray-800 text-sm mt-0.5">{detailJob.serviceType}</p>
                  </div>
                )}
                <div className="col-span-2 bg-gray-50 rounded-xl p-3">
                  <p className="text-xs text-gray-400 font-semibold">📝 Problem</p>
                  <p className="font-bold text-gray-800 text-sm mt-0.5">{detailJob.problemDescription}</p>
                </div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
