import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc, setDoc, query, where } from 'firebase/firestore'
import { db, auth } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'

const ROLE_COLORS = {
  admin:      'bg-purple-100 text-purple-700',
  technician: 'bg-aqua-100 text-aqua-700',
}

const ROLE_LABELS = {
  admin:      'Admin',
  technician: 'Technician',
}

export default function Employees() {
  const { isDark } = useTheme()
  const { user: currentUser } = useAuth()
  const [users, setUsers]         = useState([])
  const [modal, setModal]         = useState(false)
  const [form, setForm]           = useState({ name: '', email: '', password: '', phone: '' })
  const [saving, setSaving]       = useState(false)
  const [filter, setFilter]       = useState('all')

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(all.filter(u => u.role !== 'admin' || u.id === currentUser?.uid))
    })
  }, [currentUser])

  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      // Get current admin's auth token before creating technician
      const adminIdToken = await auth.currentUser?.getIdToken()
      const adminUid = auth.currentUser?.uid
      const adminEmail = auth.currentUser?.email

      // Create new technician account
      const { user: newUser } = await createUserWithEmailAndPassword(auth, form.email, form.password)
      
      // Create Firestore document for technician
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        name: form.name,
        email: form.email,
        phone: form.phone,
        role: 'technician',
        isActive: true,
        isApproved: true,
        isOnline: false,
        createdAt: new Date(),
      })

      // Force the auth state back to admin by using the stored token
      // This is a workaround - we're telling Firebase to recognize the admin session
      if (adminUid && adminEmail) {
        // Store admin info in session storage temporarily
        sessionStorage.setItem('adminUid', adminUid)
        sessionStorage.setItem('adminEmail', adminEmail)
        
        // Reload the page to restore admin session from localStorage
        // But first, show success message
        toast.success('Technician added successfully!')
        setModal(false)
        setForm({ name: '', email: '', password: '', phone: '' })
        
        // Small delay then reload to show the toast
        setTimeout(() => {
          window.location.reload()
        }, 1500)
      }
    } catch (err) {
      console.error('Error adding technician:', err)
      if (err.code === 'auth/email-already-in-use') {
        toast.error('Email already in use')
      } else if (err.code === 'auth/weak-password') {
        toast.error('Password should be at least 6 characters')
      } else {
        toast.error(err.message)
      }
      setSaving(false)
    }
  }

  const toggleActive = async (u) => {
    await updateDoc(doc(db, 'users', u.id), { isActive: !u.isActive })
    toast.success(u.isActive ? 'Deactivated' : 'Activated')
  }

  const approveTechnician = async (u) => {
    await updateDoc(doc(db, 'users', u.id), { role: 'technician', isApproved: true, isActive: true })
    toast.success(`${u.name} has been approved and activated!`)
    if (newTechs.length === 1) setFilter('all')
  }

  const [selectedTech, setSelectedTech] = useState(null)
  const [techStats, setTechStats]       = useState(null)
  const [damagedModal, setDamagedModal] = useState(false)
  const [damagedDetails, setDamagedDetails] = useState([])

  const openTechStats = (tech) => {
    setSelectedTech(tech)
    setTechStats(null)
    const unsubs = []

    unsubs.push(onSnapshot(
      query(collection(db, 'service_jobs'), where('technicianId', '==', tech.id)),
      snap => {
        const jobs = snap.docs.map(d => d.data())
        setTechStats(s => ({
          ...(s || {}),
          totalJobs:    jobs.length,
          newFitting:   jobs.filter(j => j.serviceType === 'New Fitting').length,
          serviceRepair: jobs.filter(j => j.serviceType === 'Service / Repair').length,
          completed:    jobs.filter(j => ['completed', 'verified'].includes(j.status)).length,
          pending:      jobs.filter(j => ['pending', 'assigned', 'in_progress'].includes(j.status)).length,
        }))
      }
    ))

    // Damaged products from stock_transactions (logged when invoice is saved)
    unsubs.push(onSnapshot(
      query(collection(db, 'stock_transactions'), where('technicianId', '==', tech.id)),
      snap => {
        const txns = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(t => (t.damagedQuantity || 0) > 0)
        // Store full details for modal
        setDamagedDetails(txns)
        // Aggregate by product name for count
        const map = {}
        txns.forEach(t => {
          const key = t.productName || t.productId
          if (!map[key]) map[key] = { productName: t.productName, quantity: 0 }
          map[key].quantity += t.damagedQuantity || 0
        })
        setTechStats(s => ({ ...(s || {}), damagedProducts: Object.values(map) }))
      }
    ))

    return () => unsubs.forEach(u => u())
  }

  // New technicians = role is customer/technician but not yet approved by admin
  const newTechs      = users.filter(u => u.role !== 'admin' && !u.isApproved)
  const technicians   = users.filter(u => u.role === 'technician' && u.isApproved)
  const approvedTechs = technicians
  const filtered =
    filter === 'new'
      ? newTechs
      : filter === 'all'
      ? approvedTechs
      : approvedTechs.filter(u => u.isActive === (filter === 'active'))

  // Auto-switch to 'new' tab when new technicians arrive and we're on 'all'
  useEffect(() => {
    if (newTechs.length > 0 && filter === 'all') setFilter('new')
  }, [newTechs.length])

  return (
    <div className="pb-20 md:pb-0">
      {/* Header with Back Button and Title */}
      <div className={`flex items-center justify-center px-4 py-4 border rounded-full mx-4 mb-5 relative ${
        isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
      }`}>
        <button
          onClick={() => window.history.back()}
          className={`absolute left-4 p-2 rounded-lg transition-all ${
            isDark
              ? 'hover:bg-white/10 text-white/70 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
          }`}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className={`text-xl font-bold ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          MY TECHNICIANS
        </h1>
      </div>

      <div className="space-y-4">
      {/* Add Technician Button */}
      <div className="flex justify-center">
        <button
          onClick={() => setModal(true)}
          className={`px-6 py-3 rounded-xl text-sm font-bold shadow-lg transition-shadow ${
            isDark
              ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-cyan-500/20 hover:shadow-cyan-500/40'
              : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-aqua-200 hover:shadow-aqua-300'
          }`}
        >
          + Add Technician
        </button>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-2 pb-1 overflow-x-auto scrollbar-hide">
          {([['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive'], ...(newTechs.length > 0 ? [['new', 'New Technicians']] : [])]).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                filter === val
                  ? isDark
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/25'
                    : 'bg-gradient-to-r from-aqua-500 to-aqua-600 text-white shadow-lg shadow-aqua-300/40'
                  : isDark
                  ? 'bg-white/5 text-white/70 border border-white/10 hover:bg-white/10 hover:border-white/20'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
              }`}
            >
              {label}
              {val === 'new' && newTechs.length > 0 && (
                <span className={`text-xs font-black px-1.5 py-0.5 rounded-full ${
                  filter === 'new' ? 'bg-white/30 text-white' : 'bg-orange-500 text-white'
                }`}>
                  {newTechs.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        {filtered.map(u => (
          <div key={u.id} onClick={() => openTechStats(u)} className={`rounded-2xl p-4 shadow-sm border cursor-pointer transition hover:shadow-md ${
            isDark ? 'bg-dark-card border-white/10 hover:border-white/20' : 'bg-white border-gray-100 hover:border-gray-300'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                  isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-aqua-100 text-aqua-700'
                }`}>
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-800'}`}>{u.name}</p>
                  <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{u.email}</p>
                  {u.phone && <p className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>+91 {u.phone}</p>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${
                    isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-aqua-100 text-aqua-700'
                  }`}>
                    Technician
                  </span>
                </div>
              </div>
              {u.id !== currentUser?.uid && (
                !u.isApproved ? (
                  <button
                    onClick={e => { e.stopPropagation(); approveTechnician(u) }}
                    className={`text-xs font-bold px-3 py-1.5 rounded-xl transition ${
                      isDark
                        ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/40'
                        : 'bg-orange-50 text-orange-600 hover:bg-orange-100'
                    }`}
                  >
                    Join
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); toggleActive(u) }}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                      u.isActive
                        ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-600'
                        : isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                )
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className={`text-center text-sm py-8 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>No technicians found</p>
        )}
      </div>
      </div>

      <Modal open={!!selectedTech} onClose={() => { setSelectedTech(null); setTechStats(null) }} title="Technician Report">
        {selectedTech && (
          <div className="space-y-5">
            {/* Profile */}
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-lg ${
                isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-100 text-cyan-700'
              }`}>
                {selectedTech.name?.[0]?.toUpperCase()}
              </div>
              <div>
                <p className={`font-black text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>{selectedTech.name}</p>
                <p className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{selectedTech.email}</p>
              </div>
            </div>

            {!techStats ? (
              <p className={`text-center text-sm py-4 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Loading...</p>
            ) : (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

                  {/* Job Stats */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Job Statistics</p>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Total Jobs',  value: techStats.totalJobs,   color: isDark ? 'bg-cyan-500/20 text-cyan-300' : 'bg-cyan-50 text-cyan-700' },
                        { label: 'Completed',   value: techStats.completed,   color: isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-50 text-green-700' },
                        { label: 'Pending',     value: techStats.pending,     color: isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-50 text-amber-700' },
                      ].map(stat => (
                        <div key={stat.label} className={`rounded-xl p-3 text-center ${stat.color}`}>
                          <p className="text-2xl font-black">{stat.value}</p>
                          <p className="text-xs font-semibold mt-0.5 opacity-80">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Service Type */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>Service Type</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                        <p className="text-2xl font-black">{techStats.newFitting}</p>
                        <p className="text-xs font-semibold mt-0.5 opacity-80">🔧 New Fitting</p>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${isDark ? 'bg-orange-500/20 text-orange-300' : 'bg-orange-50 text-orange-700'}`}>
                        <p className="text-2xl font-black">{techStats.serviceRepair}</p>
                        <p className="text-xs font-semibold mt-0.5 opacity-80">🛠️ Service/Repair</p>
                      </div>
                    </div>
                  </div>

                  {/* Damaged Products Button */}
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-widest mb-3 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      Damaged Products
                    </p>
                    {!techStats.damagedProducts || techStats.damagedProducts.length === 0 ? (
                      <p className={`text-sm text-center py-3 rounded-xl ${isDark ? 'bg-white/5 text-white/30' : 'bg-gray-50 text-gray-400'}`}>
                        No damaged products recorded yet
                      </p>
                    ) : (
                      <button
                        onClick={() => setDamagedModal(true)}
                        className={`w-full rounded-xl px-4 py-3 text-left transition-all border-2 ${
                          isDark 
                            ? 'bg-red-500/10 border-red-500/30 hover:border-red-500/50 hover:bg-red-500/20' 
                            : 'bg-red-50 border-red-200 hover:border-red-300 hover:bg-red-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-bold ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                              View Damaged Products
                            </p>
                            <p className={`text-xs mt-1 ${isDark ? 'text-red-400/60' : 'text-red-600/60'}`}>
                              {techStats.damagedProducts.length} product{techStats.damagedProducts.length > 1 ? 's' : ''} • Total: {techStats.damagedProducts.reduce((sum, p) => sum + p.quantity, 0)} items
                            </p>
                          </div>
                          <svg className={`w-5 h-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </div>

                </motion.div>
              </AnimatePresence>
            )}
          </div>
        )}
      </Modal>

      <Modal open={modal} onClose={() => { setModal(false); setForm({ name: '', email: '', password: '', phone: '' }) }} title="Add Technician">
        <form onSubmit={handleAdd} className="space-y-3">
          {[
            ['name',     'Full Name',  'text'],
            ['email',    'Email',      'email'],
            ['password', 'Password',   'password'],
            ['phone',    'Phone',      'tel'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
              />
            </div>
          ))}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setModal(false); setForm({ name: '', email: '', password: '', phone: '' }) }} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Adding...' : 'Add Technician'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Damaged Products Modal */}
      <Modal 
        open={damagedModal} 
        onClose={() => setDamagedModal(false)} 
        title={`Damaged Products - ${selectedTech?.name || 'Technician'}`}
        size="lg"
      >
        <div className="space-y-4">
          {/* Summary Card */}
          <div className={`rounded-xl p-4 border-2 ${
            isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-red-400/60' : 'text-red-600/60'}`}>
                  Total Damaged
                </p>
                <p className={`text-3xl font-black mt-1 ${isDark ? 'text-red-300' : 'text-red-700'}`}>
                  {damagedDetails.reduce((sum, d) => sum + (d.damagedQuantity || 0), 0)}
                </p>
              </div>
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl ${
                isDark ? 'bg-red-500/20' : 'bg-red-100'
              }`}>
                ✕
              </div>
            </div>
          </div>

          {/* Products grouped by date */}
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {(() => {
              // Group by date
              const grouped = {}
              damagedDetails.forEach(item => {
                // Use timestamp field (set when invoice is saved)
                let dateObj = null
                if (item.timestamp?.toDate) {
                  dateObj = item.timestamp.toDate()
                } else if (item.timestamp?.seconds) {
                  dateObj = new Date(item.timestamp.seconds * 1000)
                } else if (item.createdAt?.toDate) {
                  dateObj = item.createdAt.toDate()
                } else if (item.createdAt?.seconds) {
                  dateObj = new Date(item.createdAt.seconds * 1000)
                }

                const date = dateObj ? 
                  dateObj.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : 'Unknown Date'
                  
                if (!grouped[date]) grouped[date] = []
                grouped[date].push(item)
              })

              return Object.entries(grouped).map(([date, items]) => (
                <div key={date}>
                  {/* Date Header */}
                  <div className={`sticky top-0 px-3 py-2 rounded-lg mb-2 ${
                    isDark ? 'bg-white/10 backdrop-blur-sm' : 'bg-gray-100'
                  }`}>
                    <p className={`text-xs font-bold uppercase tracking-wider ${
                      isDark ? 'text-white/60' : 'text-gray-600'
                    }`}>
                      📅 {date}
                    </p>
                  </div>

                  {/* Products for this date */}
                  <div className="space-y-2 pl-2">
                    {items.map((item, idx) => (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`rounded-xl px-4 py-3 border ${
                          isDark 
                            ? 'bg-white/5 border-white/10' 
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {item.productName || 'Unknown Product'}
                            </p>
                            {item.jobId && (
                              <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                                Job ID: {item.jobId.slice(0, 8)}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-black px-3 py-1.5 rounded-lg ${
                              isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-600'
                            }`}>
                              ✕ {item.damagedQuantity}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))
            })()}
          </div>

          {damagedDetails.length === 0 && (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">📦</p>
              <p className={`text-sm ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                No damaged products found
              </p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
