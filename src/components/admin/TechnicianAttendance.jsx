import React, { useEffect, useState } from 'react'
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '../../firebase'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { useNavigate } from 'react-router-dom'

export default function TechnicianAttendance() {
  const { isDark } = useTheme()
  const navigate = useNavigate()
  const [technicians, setTechnicians] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])
  const [selectedTechnicianId, setSelectedTechnicianId] = useState('')
  const [selectedTechnicianName, setSelectedTechnicianName] = useState('')
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [periodFilter, setPeriodFilter] = useState('today')
  const [customDateRange, setCustomDateRange] = useState({ start: '', end: '' })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeView, setActiveView] = useState(null) // 'total', 'present', 'absent'

  // Load technicians
  useEffect(() => {
    const unsubscribe = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'technician')),
      (snap) => {
        const techList = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setTechnicians(techList)
      }
    )
    return unsubscribe
  }, [])

  // Load today's attendance for all technicians
  useEffect(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const unsubscribe = onSnapshot(
      collection(db, 'attendance'),
      (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        const todayRecords = records.filter(record => {
          const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date?.seconds * 1000 || 0)
          return recordDate >= today && recordDate < tomorrow
        })
        setTodayAttendance(todayRecords)
      }
    )
    return unsubscribe
  }, [])

  // Load attendance records when technician is selected
  useEffect(() => {
    if (!selectedTechnicianId) {
      setAttendanceRecords([])
      return
    }

    setLoading(true)
    const unsubscribe = onSnapshot(
      query(collection(db, 'attendance'), where('technicianId', '==', selectedTechnicianId)),
      (snap) => {
        const records = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        records.sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate() : new Date(a.date?.seconds * 1000 || 0)
          const dateB = b.date?.toDate ? b.date.toDate() : new Date(b.date?.seconds * 1000 || 0)
          return dateB - dateA
        })
        setAttendanceRecords(records)
        setLoading(false)
      }
    )
    return unsubscribe
  }, [selectedTechnicianId])

  const formatTime = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  }

  const formatDate = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatRangeLabel = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const day = date.getDate()
    const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'
    return `${day}${suffix} ${date.toLocaleDateString('en-IN', { month: 'short' })}`
  }

  const formatDateOnly = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getDateRange = () => {
    if (periodFilter === 'custom') {
      if (customDateRange.start && customDateRange.end) {
        return { 
          start: new Date(customDateRange.start), 
          end: new Date(new Date(customDateRange.end).getTime() + 86400000)
        }
      }
      // Fallback to today if dates not set
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return { start: today, end: tomorrow }
    }
    
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    switch(periodFilter) {
      case 'today':
        return { start: today, end: tomorrow }
      case 'week':
        const weekStart = new Date(today)
        const dayOfWeek = today.getDay()
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        weekStart.setDate(today.getDate() - daysFromMonday)
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        return { start: weekStart, end: weekEnd }
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        return { start: monthStart, end: monthEnd }
      default:
        return { start: new Date(0), end: new Date(8640000000000000) }
    }
  }

  const calculateWorkingHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return '—'
    const checkInDate = checkIn.toDate ? checkIn.toDate() : new Date(checkIn.seconds * 1000)
    const checkOutDate = checkOut.toDate ? checkOut.toDate() : new Date(checkOut.seconds * 1000)
    const diff = checkOutDate - checkInDate
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  const filteredRecords = React.useMemo(() => {
    const { start, end } = getDateRange()
    return attendanceRecords.filter(record => {
      const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date?.seconds * 1000 || 0)
      return recordDate >= start && recordDate < end
    })
  }, [attendanceRecords, periodFilter, customDateRange.start, customDateRange.end])

  const groupedRecords = React.useMemo(() => {
    if (periodFilter !== 'today') return {}
    const grouped = {}
    filteredRecords.forEach(record => {
      const dateKey = formatDateOnly(record.date)
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(record)
    })
    return grouped
  }, [filteredRecords, periodFilter])

  // Build calendar days for week/month/custom heatmap
  const calendarDays = React.useMemo(() => {
    if (periodFilter === 'today' || !selectedTechnicianId) return []
    if (periodFilter === 'custom' && (!customDateRange.start || !customDateRange.end)) return []
    const { start, end } = getDateRange()
    const days = []
    const cursor = new Date(start)
    const presentSet = new Set(
      filteredRecords.map(r => {
        const d = r.date?.toDate ? r.date.toDate() : new Date(r.date?.seconds * 1000 || 0)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
    while (cursor < end) {
      const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`
      days.push({ date: new Date(cursor), present: presentSet.has(key) })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }, [filteredRecords, periodFilter, customDateRange.start, customDateRange.end, selectedTechnicianId])

  // Calculate present/absent days for week/month/custom
  const periodStats = React.useMemo(() => {
    if (!selectedTechnicianId || periodFilter === 'today') return null
    // Don't calculate stats if custom range is selected but dates aren't set
    if (periodFilter === 'custom' && (!customDateRange.start || !customDateRange.end)) return null
    
    const { start, end } = getDateRange()
    const totalDays = []
    const cursor = new Date(start)
    while (cursor < end) {
      totalDays.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    
    const presentDates = new Set(
      filteredRecords.map(r => {
        const d = r.date?.toDate ? r.date.toDate() : new Date(r.date?.seconds * 1000 || 0)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
    const present = presentDates.size
    const absent = totalDays.length - present
    return { present, absent, total: totalDays.length }
  }, [selectedTechnicianId, periodFilter, customDateRange.start, customDateRange.end, filteredRecords])

  // Calculate stats
  const totalTechnicians = technicians.length
  const presentTechnicians = technicians.filter(tech => 
    todayAttendance.some(att => att.technicianId === tech.id)
  )
  const absentTechnicians = technicians.filter(tech => 
    !todayAttendance.some(att => att.technicianId === tech.id)
  )

  const PeriodStatCard = ({ title, count, color }) => (
    <div
      className={`rounded-2xl p-4 flex flex-col items-center justify-center gap-1 ${
        color === 'blue' ? isDark ? 'text-blue-300' : 'text-blue-700'
        : color === 'green' ? isDark ? 'text-green-300' : 'text-green-700'
        : isDark ? 'text-red-300' : 'text-red-700'
      }`}
      style={isDark
        ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
        : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
      }
    >
      <p style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }} className="mb-1">{count}</p>
      <p style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.2 }} className="text-center opacity-80">{title}</p>
    </div>
  )

  const StatCard = ({ title, count, color, isActive, onClick }) => (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={`rounded-2xl p-3 transition-all ${
        color === 'blue' ? isDark ? 'text-blue-300' : 'text-blue-700'
        : color === 'green' ? isDark ? 'text-green-300' : 'text-green-700'
        : isDark ? 'text-red-300' : 'text-red-700'
      }`}
      style={isActive
        ? isDark
          ? { background: '#151B2B', boxShadow: 'inset 4px 4px 10px rgba(0,0,0,0.7), inset -3px -3px 8px rgba(255,255,255,0.04)', outline: `1px solid ${color === 'blue' ? 'rgba(59,130,246,0.4)' : color === 'green' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }
          : { background: '#e8f0f7', boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.9)', outline: `1px solid ${color === 'blue' ? 'rgba(59,130,246,0.4)' : color === 'green' ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}` }
        : isDark
          ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
          : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
      }
    >
      <div className="flex flex-col items-center justify-center py-2 gap-1 w-full">
        <p style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }} className="mb-1">{count}</p>
        <p style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.2 }} className="text-center opacity-80">{title}</p>
      </div>
    </motion.button>
  )

  return (
    <div className="space-y-5 pb-28 md:pb-32">
      {/* Pill-shaped Header with Back Button */}
      <div className="-mx-6 md:-mx-8 px-6 md:px-8 py-4" style={isDark ? { background: '#151B2B' } : { background: '#e8f0f7' }}>
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-full"
          style={isDark ? {
            background: '#151B2B',
            boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)'
          } : {
            background: '#e8f0f7',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
          }}
        >
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/admin')}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-all flex-shrink-0 ${isDark ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}
            style={isDark
              ? { background: '#151B2B', boxShadow: '-2px -2px 5px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
              : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 5px rgba(163,177,198,0.5)' }
            }
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </motion.button>
          <h2 className={`text-base sm:text-lg font-black tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>TECHNICIAN ATTENDANCE</h2>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard title="Total Technicians" count={totalTechnicians} color="blue" isActive={activeView === 'total'} onClick={() => setActiveView(activeView === 'total' ? null : 'total')} />
        <StatCard title="Present" count={presentTechnicians.length} color="green" isActive={activeView === 'present'} onClick={() => setActiveView(activeView === 'present' ? null : 'present')} />
        <StatCard title="Absent" count={absentTechnicians.length} color="red" isActive={activeView === 'absent'} onClick={() => setActiveView(activeView === 'absent' ? null : 'absent')} />
      </div>

      {/* Expanded View Below Stats */}
      <AnimatePresence mode="wait">
        {activeView && (
          <motion.div
            key={activeView}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div
              className="rounded-2xl p-5"
              style={isDark
                ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
                : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
              }
            >
              {/* Header */}
              <div className="flex items-center gap-2 mb-4">
                {activeView === 'total' && (
                  <svg className={`w-5 h-5 ${isDark ? 'text-blue-300' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-4-4h-1M9 20H4v-2a4 4 0 014-4h1m4 0a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6 3 3 0 000 6zM3 14a3 3 0 100-6 3 3 0 000 6z" />
                  </svg>
                )}
                {activeView === 'present' && (
                  <svg className={`w-5 h-5 ${isDark ? 'text-green-300' : 'text-green-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                {activeView === 'absent' && (
                  <svg className={`w-5 h-5 ${isDark ? 'text-red-300' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )}
                <h3 className={`text-base font-black ${
                  activeView === 'total' ? isDark ? 'text-blue-300' : 'text-blue-700'
                  : activeView === 'present' ? isDark ? 'text-green-300' : 'text-green-700'
                  : isDark ? 'text-red-300' : 'text-red-700'
                }`}>
                  {activeView === 'total' ? `All Technicians (${totalTechnicians})` : activeView === 'present' ? `Present Today (${presentTechnicians.length})` : `Absent Today (${absentTechnicians.length})`}
                </h3>
              </div>

              {/* Tech list — no scroll */}
              <div className="space-y-3">
                {(activeView === 'total' ? technicians : activeView === 'present' ? presentTechnicians : absentTechnicians).length > 0
                  ? (activeView === 'total' ? technicians : activeView === 'present' ? presentTechnicians : absentTechnicians).map((tech, i) => {
                      const attendance = activeView === 'present' ? todayAttendance.find(att => att.technicianId === tech.id) : null
                      const isPresent = todayAttendance.some(att => att.technicianId === tech.id)
                      return (
                        <motion.div
                          key={tech.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="rounded-xl p-4"
                          style={isDark
                            ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.6), inset -2px -2px 5px rgba(255,255,255,0.04)' }
                            : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.45), inset -3px -3px 7px rgba(255,255,255,0.9)' }
                          }
                        >
                          <div className={`flex items-center gap-3 ${activeView === 'present' ? 'mb-3' : ''}`}>
                            {/* Avatar */}
                            <div
                              className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                                activeView === 'absent' ? isDark ? 'text-red-300' : 'text-red-600'
                                : activeView === 'present' ? isDark ? 'text-green-300' : 'text-green-600'
                                : isPresent ? isDark ? 'text-green-300' : 'text-green-600' : isDark ? 'text-red-300' : 'text-red-600'
                              }`}
                              style={isDark
                                ? { background: '#151B2B', boxShadow: '-2px -2px 5px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
                                : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 5px rgba(163,177,198,0.5)' }
                              }
                            >
                              {tech.name?.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={`font-bold text-sm truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{tech.name}</p>
                              <p className={`text-xs truncate ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{tech.phone}</p>
                            </div>
                            {/* Badge */}
                            {activeView === 'total' && (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${
                                  isPresent ? isDark ? 'text-green-300' : 'text-green-700' : isDark ? 'text-red-300' : 'text-red-700'
                                }`}
                                style={isDark
                                  ? { background: '#151B2B', boxShadow: '-2px -2px 4px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
                                  : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 4px rgba(163,177,198,0.5)' }
                                }
                              >
                                {isPresent ? 'Present' : 'Absent'}
                              </span>
                            )}
                            {activeView === 'present' && (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 flex items-center gap-1 ${
                                  attendance?.checkOut ? isDark ? 'text-emerald-300' : 'text-emerald-700' : isDark ? 'text-amber-300' : 'text-amber-700'
                                }`}
                                style={isDark
                                  ? { background: '#151B2B', boxShadow: '-2px -2px 4px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
                                  : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 4px rgba(163,177,198,0.5)' }
                                }
                              >
                                {!attendance?.checkOut && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                                {attendance?.checkOut ? 'Complete' : 'Active'}
                              </span>
                            )}
                            {activeView === 'absent' && (
                              <span
                                className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${isDark ? 'text-red-300' : 'text-red-700'}`}
                                style={isDark
                                  ? { background: '#151B2B', boxShadow: '-2px -2px 4px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
                                  : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 4px rgba(163,177,198,0.5)' }
                                }
                              >
                                Not Marked
                              </span>
                            )}
                          </div>
                          {/* Time grid for present */}
                          {activeView === 'present' && (
                            <div className="grid grid-cols-3 gap-2">
                              {[['Check In', formatTime(attendance?.checkIn), isDark ? 'text-green-300' : 'text-green-700'],
                                ['Check Out', formatTime(attendance?.checkOut), isDark ? 'text-purple-300' : 'text-purple-700'],
                                ['Duration', calculateWorkingHours(attendance?.checkIn, attendance?.checkOut), isDark ? 'text-blue-300' : 'text-blue-700']
                              ].map(([label, value, color]) => (
                                <div
                                  key={label}
                                  className="rounded-lg p-2.5"
                                  style={isDark
                                    ? { background: '#151B2B', boxShadow: '-2px -2px 4px rgba(255,255,255,0.04), 2px 2px 5px rgba(0,0,0,0.6)' }
                                    : { background: '#e8f0f7', boxShadow: '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 4px rgba(163,177,198,0.5)' }
                                  }
                                >
                                  <p className={`text-[10px] font-semibold mb-0.5 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{label}</p>
                                  <p className={`text-xs font-black ${color}`}>{value}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </motion.div>
                      )
                    })
                  : (
                    <div className="flex flex-col items-center py-8 gap-3">
                      <svg className={`w-10 h-10 ${isDark ? 'text-white/20' : 'text-gray-300'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                        {activeView === 'absent' ? 'All technicians are present!' : 'No records found'}
                      </p>
                    </div>
                  )
                }
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technician Selector */}
      <div
        className="rounded-2xl p-5"
        style={isDark ? {
          background: '#151B2B',
          boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
        } : {
          background: '#e8f0f7',
          boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
        }}
      >
        <label className={`text-xs font-bold uppercase tracking-wider block mb-3 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
          Select Technician *
        </label>
        <select
          value={selectedTechnicianId}
          onChange={(e) => {
            setSelectedTechnicianId(e.target.value)
            const tech = technicians.find(t => t.id === e.target.value)
            setSelectedTechnicianName(tech?.name || '')
          }}
          className={`w-full px-4 py-3 rounded-xl text-sm font-semibold focus:outline-none transition ${isDark ? 'text-white' : 'text-gray-900'}`}
          style={isDark
            ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)' }
            : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)' }
          }
        >
          <option value="">Choose a technician...</option>
          {technicians.map(tech => (
            <option key={tech.id} value={tech.id}>{tech.name} - {tech.phone}</option>
          ))}
        </select>
      </div>

      {/* Period Filter Pills */}
      {selectedTechnicianId && (
        <div
          className="rounded-2xl p-4"
          style={isDark ? {
            background: '#151B2B',
            boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
          } : {
            background: '#e8f0f7',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
          }}
        >
          <div className="flex gap-3 overflow-x-auto scrollbar-hide py-1 px-1 items-center">
            {[
              { key: 'today', label: 'Today' },
              { key: 'week', label: 'This Week' },
              { key: 'month', label: 'This Month' },
              { key: 'custom', label: 'Custom Range' },
            ].map(({ key, label }) => (
              <motion.button
                key={key}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setPeriodFilter(key)
                  if (key === 'custom') {
                    setShowDatePicker(true)
                  } else {
                    setShowDatePicker(false)
                    setCustomDateRange({ start: '', end: '' })
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all ${
                  periodFilter === key
                    ? isDark ? 'text-blue-300' : 'text-blue-700'
                    : isDark ? 'text-white/60' : 'text-gray-600'
                }`}
                style={periodFilter === key
                  ? isDark
                    ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.4)' }
                    : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)', border: '1px solid rgba(59,130,246,0.4)' }
                  : isDark
                    ? { background: '#151B2B', boxShadow: '-3px -3px 7px rgba(255,255,255,0.04), 3px 3px 7px rgba(0,0,0,0.6)' }
                    : { background: '#e8f0f7', boxShadow: '-3px -3px 7px rgba(255,255,255,0.9), 3px 3px 7px rgba(163,177,198,0.5)' }
                }
              >
                {label}
              </motion.button>
            ))}

          </div>
        </div>
      )}

      {/* Custom Date Range Picker */}
      {showDatePicker && periodFilter === 'custom' && selectedTechnicianId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Start Date</label>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                } focus:outline-none`}
              />
            </div>
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>End Date</label>
              <input
                type="date"
                value={customDateRange.end}
                onChange={(e) => {
                  const end = e.target.value
                  setCustomDateRange(prev => ({ ...prev, end }))
                  if (end) setShowDatePicker(false)
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                } focus:outline-none`}
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Present / Absent Summary Cards for week/month/custom */}
      {periodStats && periodFilter === 'custom' && customDateRange.start && customDateRange.end && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-center justify-between px-4 py-2.5 rounded-2xl"
          style={isDark
            ? { background: '#151B2B', boxShadow: 'inset 3px 3px 7px rgba(0,0,0,0.7), inset -2px -2px 5px rgba(255,255,255,0.04)', border: '1px solid rgba(59,130,246,0.25)' }
            : { background: '#e8f0f7', boxShadow: 'inset 3px 3px 7px rgba(163,177,198,0.5), inset -3px -3px 7px rgba(255,255,255,0.9)', border: '1px solid rgba(59,130,246,0.2)' }
          }
        >
          <span className={`text-xs font-bold ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
            {formatRangeLabel(customDateRange.start)} to {formatRangeLabel(customDateRange.end)}
          </span>
          <button
            onClick={() => { setCustomDateRange({ start: '', end: '' }); setShowDatePicker(true) }}
            className={`text-xs opacity-60 hover:opacity-100 font-bold ${isDark ? 'text-white' : 'text-gray-700'}`}
          >✕</button>
        </motion.div>
      )}
      {periodStats && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-3"
        >
          <PeriodStatCard title="Total Days" count={periodStats.total} color="blue" />
          <PeriodStatCard title="Days Present" count={periodStats.present} color="green" />
          <PeriodStatCard title="Days Absent" count={periodStats.absent} color="red" />
        </motion.div>
      )}

      {/* Attendance Records */}
      {!selectedTechnicianId ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`rounded-2xl p-12 text-center border border-dashed ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-4xl mb-3">👤</p>
          <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            Select a technician to view attendance history
          </p>
        </motion.div>
      ) : loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : periodFilter !== 'today' && calendarDays.length > 0 ? (
        // Heatmap Calendar View for week/month/custom
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={isDark ? {
            background: '#151B2B',
            boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)'
          } : {
            background: '#e8f0f7',
            boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)'
          }}
        >
          {/* Calendar header */}
          <div className="flex items-center gap-2 mb-4">
            <svg className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {periodFilter === 'week' ? 'Weekly Attendance' : periodFilter === 'month' ? 'Monthly Attendance' : 'Custom Range'}
            </span>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 gap-1.5 mb-1">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className={`text-center text-[10px] font-bold pb-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          {(() => {
            // Pad to start on Monday
            const firstDay = calendarDays[0]?.date
            const dayOfWeek = firstDay ? (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1) : 0
            const padded = [...Array(dayOfWeek).fill(null), ...calendarDays]
            const weeks = []
            for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7))
            return weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1.5 mb-1.5">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5"
                    style={day ? (isDark ? {
                      background: '#151B2B',
                      boxShadow: day.present
                        ? 'inset 2px 2px 5px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)'
                        : '-2px -2px 5px rgba(255,255,255,0.04), 2px 2px 6px rgba(0,0,0,0.6)'
                    } : {
                      background: '#e8f0f7',
                      boxShadow: day.present
                        ? 'inset 2px 2px 5px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.9)'
                        : '-2px -2px 5px rgba(255,255,255,0.9), 2px 2px 5px rgba(163,177,198,0.5)'
                    }) : {}}
                  >
                    {day && (
                      <>
                        <span className={`text-[10px] font-bold leading-none ${
                          isDark ? 'text-white/50' : 'text-gray-500'
                        }`}>{day.date.getDate()}</span>
                        {day.present ? (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke={isDark ? '#4ade80' : '#16a34a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 2l6 6M8 2l-6 6" stroke={isDark ? '#f87171' : '#dc2626'} strokeWidth="1.5" strokeLinecap="round" />
                          </svg>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))
          })()}

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 justify-end">
            <div className="flex items-center gap-1.5">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke={isDark ? '#4ade80' : '#16a34a'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Present</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2l6 6M8 2l-6 6" stroke={isDark ? '#f87171' : '#dc2626'} strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className={`text-[10px] font-semibold ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Absent</span>
            </div>
          </div>
        </motion.div>
      ) : periodFilter !== 'today' && selectedTechnicianId && !(periodFilter === 'custom' && (!customDateRange.start || !customDateRange.end)) ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className={`rounded-2xl p-12 text-center border border-dashed ${
            isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
          }`}
        >
          <p className="text-4xl mb-3">📋</p>
          <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
            No attendance records for selected period
          </p>
        </motion.div>
      ) : (
        <AnimatePresence mode="popLayout">
          <div className="space-y-6">
            {Object.keys(groupedRecords).length > 0 ? (
              Object.entries(groupedRecords).map(([date, dateRecords], dateIndex) => (
                <motion.div
                  key={date}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: dateIndex * 0.05 }}
                  className="space-y-3"
                >
                  {/* Date Header - Neumorphic */}
                  <div
                    className="sticky top-0 z-10 py-2 px-4 rounded-xl"
                    style={isDark ? {
                      background: '#151B2B',
                      boxShadow: '-3px -3px 7px rgba(255,255,255,0.04), 3px 3px 8px rgba(0,0,0,0.6)'
                    } : {
                      background: '#e8f0f7',
                      boxShadow: '-3px -3px 8px rgba(255,255,255,0.9), 3px 3px 8px rgba(163,177,198,0.5)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {date}
                        </h3>
                      </div>
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${isDark ? 'text-blue-300' : 'text-blue-700'}`}
                        style={isDark ? {
                          background: '#151B2B',
                          boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)'
                        } : {
                          background: '#e8f0f7',
                          boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.9)'
                        }}
                      >
                        {dateRecords.length} record{dateRecords.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Records for this date */}
                  <div className="grid gap-3">
                    {dateRecords.map((record, i) => (
                      <motion.div
                        key={record.id}
                        layout
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.97 }}
                        transition={{ delay: i * 0.03 }}
                        className="rounded-2xl p-4"
                        style={isDark
                          ? { background: '#151B2B', boxShadow: '-4px -4px 10px rgba(255,255,255,0.04), 4px 4px 12px rgba(0,0,0,0.6)' }
                          : { background: '#e8f0f7', boxShadow: '-5px -5px 12px rgba(255,255,255,0.9), 5px 5px 12px rgba(163,177,198,0.5)' }
                        }
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className={`font-bold text-base ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {selectedTechnicianName}
                            </p>
                            <span
                              className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 ${
                                record.checkOut ? isDark ? 'text-emerald-300' : 'text-emerald-700' : isDark ? 'text-amber-300' : 'text-amber-700'
                              }`}
                              style={isDark
                                ? { background: '#151B2B', boxShadow: 'inset 2px 2px 5px rgba(0,0,0,0.6), inset -1px -1px 3px rgba(255,255,255,0.04)' }
                                : { background: '#e8f0f7', boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.45), inset -2px -2px 5px rgba(255,255,255,0.9)' }
                              }
                            >
                              {!record.checkOut && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />}
                              {record.checkOut ? 'Complete' : 'In Progress'}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {[['Check In', formatTime(record.checkIn), isDark ? 'text-cyan-300' : 'text-cyan-700'],
                              ['Check Out', formatTime(record.checkOut), isDark ? 'text-purple-300' : 'text-purple-700'],
                              ['Duration', calculateWorkingHours(record.checkIn, record.checkOut), isDark ? 'text-emerald-300' : 'text-emerald-700']
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
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`rounded-2xl p-12 text-center border border-dashed ${
                  isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'
                }`}
              >
                <p className="text-4xl mb-3">📋</p>
                <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                  No attendance records for today
                </p>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      )}


    </div>
  )
}
