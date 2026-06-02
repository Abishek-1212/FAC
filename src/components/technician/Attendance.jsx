import React, { useState, useEffect } from 'react'
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

  const weekDays = React.useMemo(() => {
    if (filter !== 'week') return []
    const now = new Date()
    const diff = now.getDay() === 0 ? 6 : now.getDay() - 1
    const monday = new Date(now)
    monday.setDate(now.getDate() - diff)
    monday.setHours(0, 0, 0, 0)
    const toTs = (f) => {
      if (!f) return 0
      if (typeof f.toDate === 'function') return f.toDate().getTime()
      if (f.seconds) return f.seconds * 1000
      return new Date(f).getTime()
    }
    return ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => {
      const date = new Date(monday)
      date.setDate(monday.getDate() + i)
      const rec = records.find(r => {
        const d = new Date(toTs(r.date))
        d.setHours(0,0,0,0)
        return d.getTime() === date.getTime()
      })
      const isToday = date.toDateString() === new Date().toDateString()
      const isFuture = date > new Date()
      return { day, date, rec, isToday, isFuture }
    })
  }, [filter, records])

  const monthGrid = React.useMemo(() => {
    if (filter !== 'month') return []
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth()
    const firstDay = new Date(year, month, 1)
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    // 0=Sun..6=Sat → convert to Mon-start offset
    const startOffset = (firstDay.getDay() + 6) % 7
    const toTs = (f) => {
      if (!f) return 0
      if (typeof f.toDate === 'function') return f.toDate().getTime()
      if (f.seconds) return f.seconds * 1000
      return new Date(f).getTime()
    }
    const cells = []
    for (let i = 0; i < startOffset; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const rec = records.find(r => {
        const rd = new Date(toTs(r.date)); rd.setHours(0,0,0,0)
        return rd.getTime() === date.getTime()
      })
      const isToday = date.toDateString() === now.toDateString()
      const isFuture = date > now
      cells.push({ d, date, rec, isToday, isFuture })
    }
    return cells
  }, [filter, records])

  const customMonths = React.useMemo(() => {
    if (filter !== 'custom' || !customRange.start || !customRange.end) return []
    const now = new Date()
    const rangeStart = new Date(customRange.start); rangeStart.setHours(0,0,0,0)
    const rangeEnd = new Date(customRange.end); rangeEnd.setHours(23,59,59,999)
    const toTs = (f) => {
      if (!f) return 0
      if (typeof f.toDate === 'function') return f.toDate().getTime()
      if (f.seconds) return f.seconds * 1000
      return new Date(f).getTime()
    }
    const months = []
    let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1)
    const endMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1)
    while (cur <= endMonth) {
      const year = cur.getFullYear()
      const month = cur.getMonth()
      const firstDay = new Date(year, month, 1)
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      const startOffset = (firstDay.getDay() + 6) % 7
      const cells = []
      for (let i = 0; i < startOffset; i++) cells.push(null)
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d)
        if (date < rangeStart || date > rangeEnd) {
          cells.push({ d, date, rec: null, isToday: false, isFuture: false, outOfRange: true })
          continue
        }
        const rec = records.find(r => {
          const rd = new Date(toTs(r.date)); rd.setHours(0,0,0,0)
          return rd.getTime() === date.getTime()
        })
        cells.push({ d, date, rec, isToday: date.toDateString() === now.toDateString(), isFuture: date > now, outOfRange: false })
      }
      months.push({ year, month, cells })
      cur = new Date(year, month + 1, 1)
    }
    return months
  }, [filter, customRange, records])

  const periodStats = React.useMemo(() => {
    if (filter === 'today' || records.length === 0) return null
    if (filter === 'custom' && (!customRange.start || !customRange.end)) return null
    const now = new Date()
    let start, end
    if (filter === 'week') {
      const day = now.getDay()
      const diff = day === 0 ? 6 : day - 1
      start = new Date(now); start.setDate(now.getDate() - diff); start.setHours(0,0,0,0)
      end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
    } else if (filter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1)
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    } else {
      start = new Date(customRange.start); start.setHours(0,0,0,0)
      end = new Date(customRange.end); end.setHours(23,59,59,999)
    }
    const total = Math.round((end - start) / 86400000) + 1
    const present = records.length
    return { total, present, absent: Math.max(0, total - present) }
  }, [records, filter, customRange])

  return (
    <div className="space-y-5 pb-28 md:pb-32">
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
            style={canMarkIn && !loading
              ? isDark
                ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)', boxShadow: '4px 4px 10px #091a0d, -3px -3px 8px #205530' }
                : { background: 'linear-gradient(145deg, #d4f5e2, #edfff4)', boxShadow: '4px 4px 10px #a7d9b8, -3px -3px 8px #ffffff' }
              : isDark
                ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: 'inset 2px 2px 5px #0d0d0d, inset -1px -1px 4px #333333' }
                : { background: 'linear-gradient(145deg, #e0e0e0, #f0f0f0)', boxShadow: 'inset 2px 2px 5px #c8c8c8, inset -1px -1px 4px #ffffff' }
            }
            className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              canMarkIn && !loading
                ? isDark ? 'text-emerald-300' : 'text-emerald-700'
                : 'text-gray-400 cursor-not-allowed'
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
            style={canMarkOut && !loading
              ? isDark
                ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)', boxShadow: '4px 4px 10px #1a0808, -3px -3px 8px #5a2020' }
                : { background: 'linear-gradient(145deg, #ffe0e0, #fff5f5)', boxShadow: '4px 4px 10px #f0b8b8, -3px -3px 8px #ffffff' }
              : isDark
                ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: 'inset 2px 2px 5px #0d0d0d, inset -1px -1px 4px #333333' }
                : { background: 'linear-gradient(145deg, #e0e0e0, #f0f0f0)', boxShadow: 'inset 2px 2px 5px #c8c8c8, inset -1px -1px 4px #ffffff' }
            }
            className={`py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              canMarkOut && !loading
                ? isDark ? 'text-red-300' : 'text-red-600'
                : 'text-gray-400 cursor-not-allowed'
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
            style={filter === f
              ? isDark
                ? { background: 'linear-gradient(145deg, #1a2540, #0f1825)', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                : { background: 'linear-gradient(145deg, #dce4f0, #f0f5ff)', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.55), inset -2px -2px 5px rgba(255,255,255,0.9)' }
              : isDark
                ? { background: 'linear-gradient(145deg, #1c2438, #141c2e)', boxShadow: '3px 3px 8px rgba(0,0,0,0.6), -2px -2px 6px rgba(255,255,255,0.04)' }
                : { background: 'linear-gradient(145deg, #f0f5ff, #ffffff)', boxShadow: '3px 3px 8px rgba(163,177,198,0.5), -3px -3px 8px rgba(255,255,255,0.95)' }
            }
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              filter === f
                ? isDark ? 'text-blue-400' : 'text-blue-600'
                : isDark ? 'text-white/50' : 'text-gray-500'
            }`}
          >
            {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : f === 'month' ? 'This Month' : 'Custom'}
          </button>
        ))}
      </div>

      {/* Custom Range */}
      {filter === 'custom' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {/* Date pickers */}
          <div
            className="rounded-2xl p-4"
            style={isDark
              ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
              : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
            }
          >
            <div className="grid grid-cols-2 gap-3">
              {[['Start Date', 'start'], ['End Date', 'end']].map(([label, key]) => (
                <div key={key}>
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-2 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{label}</p>
                  <div
                    className="rounded-xl px-3 py-2.5"
                    style={isDark
                      ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                      : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.9)' }
                    }
                  >
                    <input
                      type="date"
                      value={customRange[key]}
                      onChange={e => setCustomRange({ ...customRange, [key]: e.target.value })}
                      className={`w-full bg-transparent text-xs font-bold outline-none ${
                        isDark ? 'text-white [color-scheme:dark]' : 'text-gray-800 [color-scheme:light]'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Range header banner — shown only when both dates picked */}
          {customRange.start && customRange.end && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl px-4 py-3 flex items-center gap-3"
              style={isDark
                ? { background: 'linear-gradient(145deg, #1a2540, #0f1825)', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                : { background: 'linear-gradient(145deg, #dce4f0, #f0f5ff)', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.55), inset -2px -2px 5px rgba(255,255,255,0.9)' }
              }
            >
              <svg className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className={`text-xs font-black flex-1 text-center ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
                {new Date(customRange.start).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                <span className={`mx-2 ${isDark ? 'text-white/30' : 'text-gray-400'}`}>→</span>
                {new Date(customRange.end).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
              <button
                onClick={() => setCustomRange({ start: '', end: '' })}
                className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-opacity hover:opacity-70"
                style={isDark
                  ? { background: 'linear-gradient(145deg, #1c2538, #141c2e)', boxShadow: '2px 2px 5px rgba(0,0,0,0.6), -1px -1px 4px rgba(255,255,255,0.04)' }
                  : { background: 'linear-gradient(145deg, #f0f5ff, #ffffff)', boxShadow: '2px 2px 5px rgba(163,177,198,0.5), -2px -2px 5px rgba(255,255,255,0.95)' }
                }
              >
                <svg className={`w-3 h-3 ${isDark ? 'text-white/50' : 'text-gray-500'}`} fill="currentColor" viewBox="0 0 24 24">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                </svg>
              </button>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Stats Cards — shown for week/month/custom */}
      {periodStats && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: 'Total Days', count: periodStats.total, color: isDark ? 'text-blue-300' : 'text-blue-700' },
            { label: 'Present', count: periodStats.present, color: isDark ? 'text-green-300' : 'text-green-700' },
            { label: 'Absent', count: periodStats.absent, color: isDark ? 'text-red-300' : 'text-red-700' },
          ].map(({ label, count, color }) => (
            <div
              key={label}
              className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-1 ${color}`}
              style={isDark
                ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
                : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
              }
            >
              <p style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }} className="mb-1">{count}</p>
              <p style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.2 }} className="text-center opacity-80">{label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Custom Range Heatmap */}
      {filter === 'custom' && customMonths.length > 0 && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : customMonths.map(({ year, month, cells }, mi) => (
            <motion.div
              key={`${year}-${month}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: mi * 0.05 }}
              className="rounded-2xl p-4"
              style={isDark
                ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
                : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
              }
            >
              <div className="flex items-center justify-between mb-3">
                <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  {new Date(year, month).toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
                </p>
                {mi === 0 && (
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Present</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Absent</span>
                    </span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-7 mb-1">
                {['M','T','W','T','F','S','S'].map((d, i) => (
                  <div key={i} className={`text-center text-[10px] font-black pb-1 ${
                    i >= 5 ? isDark ? 'text-blue-400/60' : 'text-blue-400' : isDark ? 'text-white/30' : 'text-gray-400'
                  }`}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((cell, i) => {
                  if (!cell) return <div key={`e-${i}`} />
                  const { d, rec, isToday, isFuture, outOfRange } = cell
                  const status = outOfRange ? 'out' : rec ? 'present' : isFuture ? 'future' : 'absent'
                  return (
                    <motion.div
                      key={`${year}-${month}-${d}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.008 }}
                      className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5"
                      style={
                        outOfRange
                          ? { opacity: 0.2, background: isDark ? '#151B2B' : '#e8f0f7' }
                          : isToday
                            ? isDark
                              ? { background: 'linear-gradient(145deg, #1a2540, #0f1825)', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.7), inset -1px -1px 3px rgba(255,255,255,0.05)' }
                              : { background: 'linear-gradient(145deg, #dce4f0, #f0f5ff)', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.55), inset -2px -2px 4px rgba(255,255,255,0.9)' }
                            : status === 'present'
                              ? isDark
                                ? { background: 'linear-gradient(145deg, #0d2414, #142b1a)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.03)' }
                                : { background: 'linear-gradient(145deg, #c8f0d8, #e8fff0)', boxShadow: '2px 2px 5px #a0d8b4, -1px -1px 4px #ffffff' }
                              : status === 'absent'
                                ? isDark
                                  ? { background: 'linear-gradient(145deg, #2a0d0d, #331414)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.03)' }
                                  : { background: 'linear-gradient(145deg, #ffd8d8, #fff0f0)', boxShadow: '2px 2px 5px #f0b8b8, -1px -1px 4px #ffffff' }
                                : isDark
                                  ? { background: 'linear-gradient(145deg, #161e2e, #1c2538)', boxShadow: '1px 1px 4px rgba(0,0,0,0.4), -1px -1px 3px rgba(255,255,255,0.02)' }
                                  : { background: 'linear-gradient(145deg, #eaf0f8, #f5f8fc)', boxShadow: '1px 1px 4px rgba(163,177,198,0.3), -1px -1px 3px rgba(255,255,255,0.9)' }
                      }
                    >
                      <span className={`text-[9px] font-black leading-none ${
                        outOfRange ? isDark ? 'text-white/10' : 'text-gray-200'
                          : isToday ? isDark ? 'text-blue-300' : 'text-blue-600'
                          : status === 'present' ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                          : status === 'absent' ? isDark ? 'text-red-400' : 'text-red-500'
                          : isDark ? 'text-white/20' : 'text-gray-300'
                      }`}>{d}</span>
                      {!outOfRange && status === 'present' && (
                        <svg className={`w-2.5 h-2.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                        </svg>
                      )}
                      {!outOfRange && status === 'absent' && (
                        <svg className={`w-2 h-2 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                        </svg>
                      )}
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Monthly Heatmap */}
      {filter === 'month' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={isDark
            ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
            : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
          }
        >
          {/* Month title + legend */}
          <div className="flex items-center justify-between mb-3">
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Present</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Absent</span>
              </span>
            </div>
          </div>

          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 mb-1">
            {['M','T','W','T','F','S','S'].map((d, i) => (
              <div key={i} className={`text-center text-[10px] font-black pb-1 ${
                i >= 5 ? isDark ? 'text-blue-400/60' : 'text-blue-400' : isDark ? 'text-white/30' : 'text-gray-400'
              }`}>{d}</div>
            ))}
          </div>

          {/* Calendar cells */}
          {loading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {monthGrid.map((cell, i) => {
                if (!cell) return <div key={`e-${i}`} />
                const { d, rec, isToday, isFuture } = cell
                const status = rec ? 'present' : isFuture ? 'future' : 'absent'
                return (
                  <motion.div
                    key={d}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5"
                    style={
                      isToday
                        ? isDark
                          ? { background: 'linear-gradient(145deg, #1a2540, #0f1825)', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.7), inset -1px -1px 3px rgba(255,255,255,0.05)' }
                          : { background: 'linear-gradient(145deg, #dce4f0, #f0f5ff)', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.55), inset -2px -2px 4px rgba(255,255,255,0.9)' }
                        : status === 'present'
                          ? isDark
                            ? { background: 'linear-gradient(145deg, #0d2414, #142b1a)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.03)' }
                            : { background: 'linear-gradient(145deg, #c8f0d8, #e8fff0)', boxShadow: '2px 2px 5px #a0d8b4, -1px -1px 4px #ffffff' }
                          : status === 'absent'
                            ? isDark
                              ? { background: 'linear-gradient(145deg, #2a0d0d, #331414)', boxShadow: '2px 2px 5px rgba(0,0,0,0.5), -1px -1px 3px rgba(255,255,255,0.03)' }
                              : { background: 'linear-gradient(145deg, #ffd8d8, #fff0f0)', boxShadow: '2px 2px 5px #f0b8b8, -1px -1px 4px #ffffff' }
                            : isDark
                              ? { background: 'linear-gradient(145deg, #161e2e, #1c2538)', boxShadow: '1px 1px 4px rgba(0,0,0,0.4), -1px -1px 3px rgba(255,255,255,0.02)' }
                              : { background: 'linear-gradient(145deg, #eaf0f8, #f5f8fc)', boxShadow: '1px 1px 4px rgba(163,177,198,0.3), -1px -1px 3px rgba(255,255,255,0.9)' }
                    }
                  >
                    <span className={`text-[9px] font-black leading-none ${
                      isToday
                        ? isDark ? 'text-blue-300' : 'text-blue-600'
                        : status === 'present'
                          ? isDark ? 'text-emerald-400' : 'text-emerald-700'
                          : status === 'absent'
                            ? isDark ? 'text-red-400' : 'text-red-500'
                            : isDark ? 'text-white/20' : 'text-gray-300'
                    }`}>{d}</span>
                    {status === 'present' ? (
                      <svg className={`w-2.5 h-2.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : status === 'absent' ? (
                      <svg className={`w-2 h-2 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    ) : null}
                  </motion.div>
                )
              })}
            </div>
          )}
        </motion.div>
      )}

      {/* Weekly Grid View */}
      {filter === 'week' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden"
          style={isDark
            ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
            : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
          }
        >
          {/* Header */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <p className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>Weekly Attendance</p>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Present</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Absent</span>
              </span>
            </div>
          </div>

          {/* Day rows */}
          <div className="px-3 pb-4 space-y-2">
            {loading ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              </div>
            ) : weekDays.map(({ day, date, rec, isToday, isFuture }, i) => {
              const status = rec ? 'present' : isFuture ? 'future' : 'absent'
              const duration = (() => {
                if (!rec?.checkIn || !rec?.checkOut) return null
                const a = rec.checkIn.toDate ? rec.checkIn.toDate() : new Date(rec.checkIn.seconds * 1000)
                const b = rec.checkOut.toDate ? rec.checkOut.toDate() : new Date(rec.checkOut.seconds * 1000)
                const d = b - a
                return `${Math.floor(d/3600000)}h ${Math.floor((d%3600000)/60000)}m`
              })()
              return (
                <motion.div
                  key={day}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                  style={isToday
                    ? isDark
                      ? { background: 'linear-gradient(145deg, #1a2540, #0f1825)', boxShadow: 'inset 2px 2px 6px rgba(0,0,0,0.6), inset -1px -1px 4px rgba(255,255,255,0.04)' }
                      : { background: 'linear-gradient(145deg, #dce4f0, #f0f5ff)', boxShadow: 'inset 2px 2px 6px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.9)' }
                    : isDark
                      ? { background: 'transparent' }
                      : { background: 'transparent' }
                  }
                >
                  {/* Day + date */}
                  <div className="w-10 flex-shrink-0 text-center">
                    <p className={`text-[11px] font-black uppercase tracking-wide ${
                      isToday
                        ? isDark ? 'text-blue-400' : 'text-blue-600'
                        : isDark ? 'text-white/70' : 'text-gray-600'
                    }`}>{day}</p>
                    <p className={`text-lg font-black leading-none mt-0.5 ${
                      isToday
                        ? isDark ? 'text-blue-300' : 'text-blue-700'
                        : isDark ? 'text-white/50' : 'text-gray-400'
                    }`}>{date.getDate()}</p>
                  </div>

                  {/* Divider */}
                  <div className={`w-px self-stretch ${isDark ? 'bg-white/10' : 'bg-gray-300/60'}`} />

                  {/* Status badge */}
                  <div
                    className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                      status === 'present' ? '' : status === 'absent' ? '' : ''
                    }`}
                    style={status === 'present'
                      ? isDark
                        ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)', boxShadow: '2px 2px 6px rgba(0,0,0,0.5), -1px -1px 4px rgba(255,255,255,0.04)' }
                        : { background: 'linear-gradient(145deg, #d4f5e2, #edfff4)', boxShadow: '2px 2px 6px #a7d9b8, -1px -1px 4px #ffffff' }
                      : status === 'absent'
                        ? isDark
                          ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)', boxShadow: '2px 2px 6px rgba(0,0,0,0.5), -1px -1px 4px rgba(255,255,255,0.04)' }
                          : { background: 'linear-gradient(145deg, #ffe0e0, #fff5f5)', boxShadow: '2px 2px 6px #f0b8b8, -1px -1px 4px #ffffff' }
                        : isDark
                          ? { background: 'linear-gradient(145deg, #1e2430, #252e3e)', boxShadow: '2px 2px 6px rgba(0,0,0,0.4), -1px -1px 3px rgba(255,255,255,0.03)' }
                          : { background: 'linear-gradient(145deg, #e8eef5, #f5f8fc)', boxShadow: '2px 2px 5px rgba(163,177,198,0.4), -1px -1px 4px rgba(255,255,255,0.9)' }
                    }
                  >
                    {status === 'present' ? (
                      <svg className={`w-3.5 h-3.5 ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : status === 'absent' ? (
                      <svg className={`w-3 h-3 ${isDark ? 'text-red-400' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
                      </svg>
                    ) : (
                      <span className={`text-[10px] font-bold ${isDark ? 'text-white/20' : 'text-gray-300'}`}>—</span>
                    )}
                  </div>

                  {/* Times / info */}
                  <div className="flex-1 min-w-0">
                    {status === 'present' ? (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[11px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                          IN {formatTime(rec.checkIn)}
                        </span>
                        {rec.checkOut && (
                          <>
                            <span className={`text-[10px] ${isDark ? 'text-white/20' : 'text-gray-300'}`}>·</span>
                            <span className={`text-[11px] font-bold ${isDark ? 'text-red-400' : 'text-red-500'}`}>
                              OUT {formatTime(rec.checkOut)}
                            </span>
                          </>
                        )}
                        {duration && (
                          <>
                            <span className={`text-[10px] ${isDark ? 'text-white/20' : 'text-gray-300'}`}>·</span>
                            <span className={`text-[11px] font-semibold ${isDark ? 'text-blue-300' : 'text-blue-500'}`}>
                              {duration}
                            </span>
                          </>
                        )}
                        {!rec.checkOut && (
                          <span className={`text-[10px] font-bold flex items-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-500'}`}>
                            <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
                            In Progress
                          </span>
                        )}
                      </div>
                    ) : status === 'absent' ? (
                      <p className={`text-[11px] font-semibold ${isDark ? 'text-red-400/70' : 'text-red-400'}`}>Absent</p>
                    ) : (
                      <p className={`text-[11px] font-semibold ${isDark ? 'text-white/20' : 'text-gray-300'}`}>Upcoming</p>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}
      <div className={`space-y-3 ${filter === 'week' || filter === 'month' || (filter === 'custom' && customMonths.length > 0) ? 'hidden' : ''}`}>
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
            style={isDark
              ? { background: '#151B2B' }
              : { background: '#e8f0f7' }
            }
            className="rounded-2xl max-w-sm w-full overflow-hidden"
          >
            <div
              style={isDark
                ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)' }
                : { background: 'linear-gradient(145deg, #d4f5e2, #edfff4)' }
              }
              className="p-6 text-center"
            >
              <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
              </svg>
              <h3 className={`text-xl font-black ${isDark ? 'text-emerald-200' : 'text-emerald-800'}`}>Mark Attendance</h3>
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
                  style={isDark
                    ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: '4px 4px 10px #0d0d0d, -3px -3px 8px #333333' }
                    : { background: 'linear-gradient(145deg, #e2e8f0, #f8faff)', boxShadow: '4px 4px 10px #c0c8d8, -3px -3px 8px #ffffff' }
                  }
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => markAttendance('in')}
                  disabled={loading}
                  style={isDark
                    ? { background: 'linear-gradient(145deg, #14321a, #1a3f22)', boxShadow: '4px 4px 10px #091a0d, -3px -3px 8px #205530' }
                    : { background: 'linear-gradient(145deg, #d4f5e2, #edfff4)', boxShadow: '4px 4px 10px #a7d9b8, -3px -3px 8px #ffffff' }
                  }
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}
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
            style={isDark
              ? { background: '#151B2B' }
              : { background: '#e8f0f7' }
            }
            className="rounded-2xl max-w-sm w-full overflow-hidden"
          >
            <div
              style={isDark
                ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)' }
                : { background: 'linear-gradient(145deg, #ffe0e0, #fff5f5)' }
              }
              className="p-6 text-center"
            >
              <svg className={`w-12 h-12 mx-auto mb-3 ${isDark ? 'text-red-300' : 'text-red-600'}`} fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
              </svg>
              <h3 className={`text-xl font-black ${isDark ? 'text-red-200' : 'text-red-800'}`}>Mark Out</h3>
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
                  style={isDark
                    ? { background: 'linear-gradient(145deg, #1e1e1e, #2a2a2a)', boxShadow: '4px 4px 10px #0d0d0d, -3px -3px 8px #333333' }
                    : { background: 'linear-gradient(145deg, #e2e8f0, #f8faff)', boxShadow: '4px 4px 10px #c0c8d8, -3px -3px 8px #ffffff' }
                  }
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
                >
                  Cancel
                </button>
                <button
                  onClick={() => markAttendance('out')}
                  disabled={loading}
                  style={isDark
                    ? { background: 'linear-gradient(145deg, #3b1111, #4a1a1a)', boxShadow: '4px 4px 10px #1a0808, -3px -3px 8px #5a2020' }
                    : { background: 'linear-gradient(145deg, #ffe0e0, #fff5f5)', boxShadow: '4px 4px 10px #f0b8b8, -3px -3px 8px #ffffff' }
                  }
                  className={`flex-1 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 flex items-center justify-center gap-2 ${isDark ? 'text-red-300' : 'text-red-600'}`}
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
