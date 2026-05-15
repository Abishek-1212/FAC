import { useEffect, useState } from 'react'
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import toast from 'react-hot-toast'

const ROLES = ['inventory_manager', 'technician', 'customer']
const ALL_ROLES = ['admin', ...ROLES]

const ROLE_COLORS = {
  admin:             'bg-purple-100 text-purple-700',
  inventory_manager: 'bg-blue-100 text-blue-700',
  technician:        'bg-aqua-100 text-aqua-700',
  customer:          'bg-green-100 text-green-700',
}

const ROLE_LABELS = {
  admin:             'Admin',
  inventory_manager: 'Inventory Manager',
  technician:        'Technician',
  customer:          'Customer',
}

export default function Employees() {
  const { user: currentUser, registerWithEmail, changeRole } = useAuth()
  const [users, setUsers]       = useState([])
  const [modal, setModal]       = useState(false)
  const [roleModal, setRoleModal] = useState(null)   // user object being edited
  const [pendingRole, setPendingRole] = useState('')
  const [form, setForm]         = useState({ name: '', email: '', password: '', role: 'technician', phone: '' })
  const [saving, setSaving]     = useState(false)
  const [filter, setFilter]     = useState('all')

  useEffect(() => {
    return onSnapshot(collection(db, 'users'), snap => {
      // Admins cannot see other admins (except themselves)
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setUsers(all.filter(u => u.role !== 'admin' || u.id === currentUser?.uid))
    })
  }, [currentUser])

  // ── add employee ──────────────────────────────────────────────────────────
  const handleAdd = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await registerWithEmail(form.email, form.password, form.name, form.phone, form.role)
      toast.success('Employee added')
      setModal(false)
      setForm({ name: '', email: '', password: '', role: 'technician', phone: '' })
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use' ? 'Email already in use' : err.message
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  // ── toggle active ─────────────────────────────────────────────────────────
  const toggleActive = async (u) => {
    await updateDoc(doc(db, 'users', u.id), { isActive: !u.isActive })
    toast.success(u.isActive ? 'Deactivated' : 'Activated')
  }

  // ── change role ───────────────────────────────────────────────────────────
  const openRoleModal = (u) => {
    setPendingRole(u.role)
    setRoleModal(u)
  }

  const handleRoleChange = async () => {
    if (!roleModal || pendingRole === roleModal.role) { setRoleModal(null); return }
    setSaving(true)
    try {
      await changeRole(roleModal.id, pendingRole)
      toast.success(`${roleModal.name}'s role changed to ${ROLE_LABELS[pendingRole]}`)
      setRoleModal(null)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  // ── filter ────────────────────────────────────────────────────────────────
  const nonAdmins = users.filter(u => u.role !== 'admin')
  const filtered  = filter === 'all' ? nonAdmins : nonAdmins.filter(u => u.role === filter)

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-gray-800">Employees</h2>
        <button
          onClick={() => setModal(true)}
          className="bg-aqua-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-aqua-600 transition"
        >
          + Add Employee
        </button>
      </div>

      {/* role filter tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {['all', ...ROLES].map(r => (
          <button
            key={r}
            onClick={() => setFilter(r)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === r ? 'bg-aqua-500 text-white' : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {r === 'all' ? 'All' : ROLE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* user list */}
      <div className="grid gap-3">
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-aqua-100 flex items-center justify-center font-bold text-aqua-700 text-sm flex-shrink-0">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                  {u.phone && <p className="text-xs text-gray-400">+91 {u.phone}</p>}
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full mt-1 inline-block ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                    {ROLE_LABELS[u.role] || u.role}
                  </span>
                </div>
              </div>

              {/* actions — skip for self */}
              {u.id !== currentUser?.uid && (
                <div className="flex flex-col gap-2 items-end">
                  <button
                    onClick={() => toggleActive(u)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition ${
                      u.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}
                  >
                    {u.isActive ? 'Active' : 'Inactive'}
                  </button>
                  <button
                    onClick={() => openRoleModal(u)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
                  >
                    Change Role
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No employees found</p>
        )}
      </div>

      {/* ── Add Employee Modal ── */}
      <Modal open={modal} onClose={() => setModal(false)} title="Add Employee">
        <form onSubmit={handleAdd} className="space-y-3">
          {[
            ['name',     'Full Name',        'text'],
            ['email',    'Email',            'email'],
            ['password', 'Password',         'password'],
            ['phone',    'Phone (optional)', 'tel'],
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                required={key !== 'phone'}
                className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
              />
            </div>
          ))}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</label>
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full mt-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-aqua-300"
            >
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-60">
              {saving ? 'Adding...' : 'Add Employee'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Change Role Modal ── */}
      <Modal open={!!roleModal} onClose={() => setRoleModal(null)} title="Change Role">
        {roleModal && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl px-4 py-3">
              <p className="font-bold text-gray-800">{roleModal.name}</p>
              <p className="text-xs text-gray-500">{roleModal.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                Current role:{' '}
                <span className={`font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[roleModal.role]}`}>
                  {ROLE_LABELS[roleModal.role]}
                </span>
              </p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">New Role</label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {ALL_ROLES.filter(r => r !== 'admin').map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPendingRole(r)}
                    className={`px-3 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${
                      pendingRole === r
                        ? 'border-aqua-500 bg-aqua-50 text-aqua-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {pendingRole !== roleModal.role && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
                ⚠️ This will change their dashboard access immediately. They'll be redirected on next login.
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setRoleModal(null)}
                className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleRoleChange}
                disabled={saving || pendingRole === roleModal.role}
                className="flex-1 bg-aqua-500 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-40 transition"
              >
                {saving ? 'Saving...' : 'Confirm Change'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
