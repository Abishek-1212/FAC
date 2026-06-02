import { useState, useEffect } from 'react'
import { collection, addDoc, query, where, getDocs, updateDoc, doc, Timestamp } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function Attendance() {
  const { user } = useAuth()
  const { isDark } = useTheme()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('today')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [todayRecord, setTodayRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [showMarkInConfirm, setShowMarkInConfirm] = useState(false)
  const [showMarkOutConfirm, setShowMarkOutConfirm] = useState(false)

  useEffect(() => {
    if (user) {
      fetchRecords()
    }
  }, [user, filter, customRange])

  const fetchRecords = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { start, end } = getDateRange()
      const q = query(
        collection(db, 'attendance'),
        where('technicianId', '==', user.uid)
      )
      const snap = await getDocs(q)
      const allData = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      
      // Helper to convert to timestamp
      const toTimestamp = (dateField) => {
        if (!dateField) return 0
        if (typeof dateField.toDate === 'function') return dateField.toDate().getTime()
        if (dateField.seconds) return dateField.seconds * 1000
        if (dateField instanceof Date) return dateField.getTime()
        return new Date(dateField).getTime()
      }
      
      const startTime = start.toDate().getTime()
      const endTime = end.toDate().getTime()
      
      // Filter by date range in memory
      const filtered = allData.filter(rec => {
        const recTime = toTimestamp(rec.date)
        return recTime >= startTime && recTime <= endTime
      })
      
      // Sort by date descending
      filtered.sort((a, b) => toTimestamp(b.date) - toTimestamp(a.date))
      
      setRecords(filtered)

      // Check today's record
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayTime = today.getTime()
      
      const todayRec = filtered.find(r => {
        const recDate = new Date(toTimestamp(r.date))
        recDate.setHours(0, 0, 0, 0)
        return recDate.getTime() === todayTime
      })
      setTodayRecord(todayRec)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const getDateRange = () => {
    const now = new Date()
    let start, end

    if (filter === 'today') {
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      end = new Date(now)
      end.setHours(23, 59, 59, 999)
    } else if (filter === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      start = new Date(now)
      start.setDate(now.getDate() - diff)
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(start.getDate() + 6)
      end.setHours(23, 59, 59, 999)
    } else if (filter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else if (filter === 'custom' && customRange.start && customRange.end) {
      start = new Date(customRange.start)
      start.setHours(0, 0, 0, 0)
      end = new Date(customRange.end)
      end.setHours(23, 59, 59, 999)
    } else {
      start = new Date(now)
      start.setHours(0, 0, 0, 0)
      end = new Date(now)
      end.setHours(23, 59, 59, 999)
    }

    return { start: Timestamp.fromDate(start), end: Timestamp.fromDate(end) }
  }

  const markAttendance = async (type) => {
    if (!user) return
    setLoading(true)
    try {
      const now = new Date()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)

      if (type === 'in') {
        // Check if already marked in today
        if (todayRecord) {
          toast.error('You have already marked attendance for today')
          setLoading(false)
          return
        }
        
        await addDoc(collection(db, 'attendance'), {
          technicianId: user.uid,
          date: Timestamp.fromDate(today),
          checkIn: Timestamp.fromDate(now),
          checkOut: null,
          createdAt: Timestamp.fromDate(now)
        })
        setShowMarkInConfirm(false)
        toast.success('✅ Marked In Successfully!')
      } else {
        if (!todayRecord) {
          toast.error('No check-in record found for today')
          return
        }
        if (todayRecord.checkOut) {
          toast.error('You have already marked out for today')
          return
        }
        await updateDoc(doc(db, 'attendance', todayRecord.id), {
          checkOut: Timestamp.fromDate(now),
          updatedAt: Timestamp.fromDate(now)
        })
        setShowMarkOutConfirm(false)
        toast.success('✅ Marked Out Successfully!')
      }
      fetchRecords()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatTime = (ts) => {
    if (!ts) return '—'
    let d
    if (typeof ts.toDate === 'function') {
      d = ts.toDate()
    } else if (ts.seconds) {
      d = new Date(ts.seconds * 1000)
    } else if (ts instanceof Date) {
      d = ts
    } else {
      d = new Date(ts)
    }
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (ts) => {
    if (!ts) return '—'
    let d
    if (typeof ts.toDate === 'function') {
      d = ts.toDate()
    } else if (ts.seconds) {
      d = new Date(ts.seconds * 1000)
    } else if (ts instanceof Date) {
      d = ts
    } else {
      d = new Date(ts)
    }
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const canMarkIn = !todayRecord
  const canMarkOut = todayRecord && !todayRecord.checkOut

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className={`p-2.5 rounded-xl ${
            isDark ? 'bg-blue-500/20' : 'bg-blue-100'
          }`}>
            <svg className={`w-6 h-6 ${
              isDark ? 'text-blue-400' : 'text-blue-600'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h2 className={`text-2xl font-black ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              My Attendance
            </h2>
            <p className={`text-sm ${
              isDark ? 'text-white/60' : 'text-gray-600'
            }`}>
              Mark your attendance and view history
            </p>
          </div>
        </div>
      </motion.div>

      {/* Mark Attendance Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl p-5 border ${
          isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
        }`}
      >
        <p className={`text-sm font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Mark Today's Attendance
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowMarkInConfirm(true)}
            disabled={!canMarkIn || loading}
            className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              canMarkIn && !loading
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
            )}
            Mark In
          </button>
          <button
            onClick={() => setShowMarkOutConfirm(true)}
            disabled={!canMarkOut || loading}
            className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              canMarkOut && !loading
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
            )}
            Mark Out
          </button>
        </div>
        {todayRecord && !todayRecord.checkOut && (
          <p className={`text-xs mt-3 text-center flex items-center justify-center gap-1 ${isDark ? 'text-green-400' : 'text-green-600'}`}>
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
            Checked in at {formatTime(todayRecord.checkIn)}
          </p>
        )}
      </motion.div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {['today', 'week', 'month', 'custom'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              filter === f
                ? isDark
                  ? 'bg-blue-500 text-white'
                  : 'bg-blue-600 text-white'
                : isDark
                ? 'bg-white/5 text-white/60 border border-white/10'
                : 'bg-white text-gray-600 border border-gray-200'
            }`}
          >
            {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Custom Range */}
      {filter === 'custom' && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`rounded-2xl p-4 border ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-100'
          }`}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                Start Date
              </label>
              <input
                type="date"
                value={customRange.start}
                onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                End Date
              </label>
              <input
                type="date"
                value={customRange.end}
                onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                className={`w-full border rounded-lg px-3 py-2 text-sm ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white'
                    : 'bg-white border-gray-200 text-gray-900'
                }`}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Records */}
      <div className="space-y-3 pb-28 md:pb-32">
        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : records.length > 0 ? (
          records.map((rec, i) => (
            <motion.div
              key={rec.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4"
              style={isDark
                ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
                : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
              }
            >
              <div className="flex items-center justify-between mb-3">
                <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {formatDate(rec.date)}
                </p>
                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 ${
                    rec.checkOut
                      ? isDark ? 'text-green-300' : 'text-green-700'
                      : isDark ? 'text-amber-300' : 'text-amber-700'
                  }`}
                  style={isDark
                    ? { background: '#151B2B', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)' }
                    : { background: '#e8f0f7', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.45), inset -2px -2px 5px rgba(255,255,255,0.9)' }
                  }
                >
                  {rec.checkOut ? (
                    <>
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                      Complete
                    </>
                  ) : (
                    <>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      In Progress
                    </>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[['Check In', formatTime(rec.checkIn), isDark ? 'text-green-300' : 'text-green-700'],
                  ['Check Out', formatTime(rec.checkOut), isDark ? 'text-red-300' : 'text-red-700'],
                  ['Duration', (() => {
                    if (!rec.checkIn || !rec.checkOut) return '—'
                    const a = rec.checkIn.toDate ? rec.checkIn.toDate() : new Date(rec.checkIn.seconds * 1000)
                    const b = rec.checkOut.toDate ? rec.checkOut.toDate() : new Date(rec.checkOut.seconds * 1000)
                    const diff = b - a
                    return `${Math.floor(diff/3600000)}h ${Math.floor((diff%3600000)/60000)}m`
                  })(), isDark ? 'text-blue-300' : 'text-blue-700']
                ].map(([label, value, color]) => (
                  <div
                    key={label}
                    className="rounded-xl p-2.5"
                    style={isDark
                      ? { background: '#151B2B', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)' }
                      : { background: '#e8f0f7', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.45), inset -2px -2px 5px rgba(255,255,255,0.9)' }
                    }
                  >
                    <p className={`text-[10px] font-semibold mb-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{label}</p>
                    <p className={`text-xs font-black ${color}`}>{value}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))
        ) : (
          <div
            className={`rounded-2xl p-12 text-center border border-dashed ${
              isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
            }`}
          >
            <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-white/20' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
              No attendance records found
            </p>
          </div>
        )}
      </div>

      {/* Mark In Confirmation Modal */}
      {showMarkInConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden ${
              isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
            }`}
          >
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 text-white text-center">
              <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
              <h3 className="text-xl font-black">Mark Attendance</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className={`rounded-xl p-4 border ${
                isDark ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
              }`}>
                <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                  isDark ? 'text-blue-300' : 'text-blue-900'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                  </svg>
                  Important
                </p>
                <p className={`text-xs ${
                  isDark ? 'text-blue-300/80' : 'text-blue-700'
                }`}>
                  You can only mark attendance once per day. Make sure you're ready to start your work day.
                </p>
              </div>

              <div className={`text-center py-3 rounded-xl ${
                isDark ? 'bg-white/5' : 'bg-gray-50'
              }`}>
                <p className={`text-xs mb-1 ${
                  isDark ? 'text-white/50' : 'text-gray-500'
                }`}>
                  Current Time
                </p>
                <p className={`text-2xl font-black ${
                  isDark ? 'text-white' : 'text-gray-900'
                }`}>
                  {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowMarkInConfirm(false)}
                  disabled={loading}
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                    isDark
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => markAttendance('in')}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl py-3 text-sm font-bold hover:from-green-600 hover:to-green-700 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                      Marking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                      Confirm Mark In
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Mark Out Confirmation Modal */}
      {showMarkOutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden ${
              isDark ? 'bg-dark-card border border-white/10' : 'bg-white'
            }`}
          >
            <div className="bg-gradient-to-r from-red-500 to-red-600 p-6 text-white text-center">
              <svg className="w-12 h-12 mx-auto mb-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
              <h3 className="text-xl font-black">Mark Out</h3>
            </div>

            <div className="p-6 space-y-4">
              <div className={`rounded-xl p-4 border ${
                isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
              }`}>
                <p className={`text-sm font-bold mb-2 flex items-center gap-2 ${
                  isDark ? 'text-amber-300' : 'text-amber-900'
                }`}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                  </svg>
                  Confirm Mark Out
                </p>
                <p className={`text-xs ${
                  isDark ? 'text-amber-300/80' : 'text-amber-700'
                }`}>
                  You're about to end your work day. Make sure you've completed all your tasks.
                </p>
              </div>

              {todayRecord && todayRecord.checkIn && (
                <div className={`rounded-xl p-4 ${
                  isDark ? 'bg-white/5' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className={`text-xs ${
                      isDark ? 'text-white/50' : 'text-gray-500'
                    }`}>
                      Check In Time
                    </p>
                    <p className={`text-sm font-bold ${
                      isDark ? 'text-green-400' : 'text-green-600'
                    }`}>
                      {formatTime(todayRecord.checkIn)}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs ${
                      isDark ? 'text-white/50' : 'text-gray-500'
                    }`}>
                      Current Time
                    </p>
                    <p className={`text-sm font-bold ${
                      isDark ? 'text-red-400' : 'text-red-600'
                    }`}>
                      {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowMarkOutConfirm(false)}
                  disabled={loading}
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition ${
                    isDark
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  } disabled:opacity-50`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => markAttendance('out')}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl py-3 text-sm font-bold hover:from-red-600 hover:to-red-700 transition disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" opacity="0.3" />
                        <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" fill="none" />
                      </svg>
                      Marking...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                      Confirm Mark Out
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
