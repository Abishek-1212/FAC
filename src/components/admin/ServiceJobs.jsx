import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

const EMPTY_FORM = { customerName: '', customerPhone: '', customerAddress: '', problemDescription: '', technicianId: '', priority: 'normal' }

export default function ServiceJobs() {
  const [jobs, setJobs] = useState([])
  const [technicians, setTechnicians] = useState([])
  const [modal, setModal] = useState(false)
  const [detailJob, setDetailJob] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    const unsub1 = onSnapshot(collection(db, 'service_jobs'), snap => {
      setJobs(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)))
    })
    const unsub2 = onSnapshot(query(collection(db, 'users'), where('role', '==', 'technician')), snap => {
      setTechnicians(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    return () => { unsub1(); unsub2() }
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
      toast.success('Job created')
      setModal(false)
      setForm(EMPTY_FORM)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, 'service_jobs', id), { status })
    toast.success(`Status updated to ${status}`)
    setDetailJob(null)
  }

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter)

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Service Jobs</h2>
        <button onClick={() => setModal(true)} className="bg-aqua-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-aqua-600 transition">
          + New Job
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', 'pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${filter === s ? 'bg-aqua-500 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === 'all' ? 'All' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="grid gap-3">
        {filtered.map(job => (
          <div key={job.id} onClick={() => setDetailJob(job)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-aqua-200 transition">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-800">{job.customerName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{job.customerPhone}</p>
                <p className="text-sm text-gray-600 mt-1">{job.problemDescription}</p>
                {job.technicianName && <p className="text-xs text-aqua-600 mt-1">👷 {job.technicianName}</p>}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-600'}`}>
                  {job.status?.replace('_', ' ')}
                </span>
                {job.priority === 'urgent' && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-semibold">Urgent</span>}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-400 text-sm py-8">No jobs found</p>}
      </div>

      {/* Create Job Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Create Service Job" size="lg">
        <form onSubmit={handleCreate} className="space-y-3">
          {[['customerName', 'Customer Name'], ['customerPhone', 'Phone Number'], ['customerAddress', 'Address']].map(([key, label]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300" />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Problem Description</label>
            <textarea value={form.problemDescription} onChange={e => setForm(f => ({ ...f, problemDescription: e.target.value }))} required rows={2} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300 resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assign Technician</label>
              <select value={form.technicianId} onChange={e => setForm(f => ({ ...f, technicianId: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300">
                <option value="">Unassigned</option>
                {technicians.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300">
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Creating...' : 'Create Job'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Job Detail Modal */}
      <Modal open={!!detailJob} onClose={() => setDetailJob(null)} title="Job Details">
        {detailJob && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-gray-500 text-xs">Customer</p><p className="font-semibold">{detailJob.customerName}</p></div>
              <div><p className="text-gray-500 text-xs">Phone</p><p className="font-semibold">{detailJob.customerPhone}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs">Address</p><p className="font-semibold">{detailJob.customerAddress}</p></div>
              <div className="col-span-2"><p className="text-gray-500 text-xs">Problem</p><p className="font-semibold">{detailJob.problemDescription}</p></div>
              <div><p className="text-gray-500 text-xs">Technician</p><p className="font-semibold">{detailJob.technicianName || 'Unassigned'}</p></div>
              <div><p className="text-gray-500 text-xs">Status</p><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[detailJob.status]}`}>{detailJob.status}</span></div>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Update Status</p>
              <div className="flex flex-wrap gap-2">
                {['pending', 'assigned', 'in_progress', 'completed', 'cancelled'].map(s => (
                  <button key={s} onClick={() => updateStatus(detailJob.id, s)} className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${detailJob.status === s ? 'bg-aqua-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {s.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
