import { useEffect, useState } from 'react'
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

  const formatDateOnly = (timestamp) => {
    if (!timestamp) return '—'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const getDateRange = () => {
    if (periodFilter === 'custom' && customDateRange.start && customDateRange.end) {
      return { 
        start: new Date(customDateRange.start), 
        end: new Date(new Date(customDateRange.end).getTime() + 86400000)
      }
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

  const filterRecordsByDateRange = () => {
    const { start, end } = getDateRange()
    return attendanceRecords.filter(record => {
      const recordDate = record.date?.toDate ? record.date.toDate() : new Date(record.date?.seconds * 1000 || 0)
      return recordDate >= start && recordDate < end
    })
  }

  const groupRecordsByDate = (recordsList) => {
    const grouped = {}
    recordsList.forEach(record => {
      const dateKey = formatDateOnly(record.date)
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(record)
    })
    return grouped
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

  const filteredRecords = filterRecordsByDateRange()
  const groupedRecords = groupRecordsByDate(filteredRecords)

  // Calculate present/absent days for week/month/custom
  const getTechnicianPeriodStats = () => {
    if (!selectedTechnicianId || periodFilter === 'today') return null
    const { start, end } = getDateRange()
    // Count all calendar days (Mon-Sun) in range
    const totalDays = []
    const cursor = new Date(start)
    while (cursor < end) {
      totalDays.push(new Date(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }
    // Unique present dates from records
    const presentDates = new Set(
      filteredRecords.map(r => {
        const d = r.date?.toDate ? r.date.toDate() : new Date(r.date?.seconds * 1000 || 0)
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      })
    )
    const present = presentDates.size
    const absent = totalDays.length - present
    return { present, absent, total: totalDays.length }
  }

  const periodStats = getTechnicianPeriodStats()

  // Calculate stats
  const totalTechnicians = technicians.length
  const presentTechnicians = technicians.filter(tech => 
    todayAttendance.some(att => att.technicianId === tech.id)
  )
  const absentTechnicians = technicians.filter(tech => 
    !todayAttendance.some(att => att.technicianId === tech.id)
  )

  const StatCard = ({ title, count, icon, color, isActive, onClick }) => (
    <motion.button
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        borderRadius: '14px',
        padding: '12px',
        boxShadow: isActive 
          ? color === 'blue'
            ? '0 4px 12px rgba(59, 130, 246, 0.25)'
            : color === 'green'
            ? '0 4px 12px rgba(34, 197, 94, 0.25)'
            : '0 4px 12px rgba(239, 68, 68, 0.25)'
          : '0 2px 8px rgba(0, 0, 0, 0.08)'
      }}
      className={`transition-all duration-300 ${
        isActive
          ? color === 'blue' 
            ? isDark ? 'bg-blue-500/20 border-2 border-blue-500/50' : 'bg-blue-50 border-2 border-blue-300'
            : color === 'green'
            ? isDark ? 'bg-green-500/20 border-2 border-green-500/50' : 'bg-green-50 border-2 border-green-300'
            : isDark ? 'bg-red-500/20 border-2 border-red-500/50' : 'bg-red-50 border-2 border-red-300'
          : color === 'blue'
          ? isDark ? 'bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20' : 'bg-blue-50 hover:bg-blue-100 border border-blue-200'
          : color === 'green'
          ? isDark ? 'bg-green-500/10 hover:bg-green-500/15 border border-green-500/20' : 'bg-green-50 hover:bg-green-100 border border-green-200'
          : isDark ? 'bg-red-500/10 hover:bg-red-500/15 border border-red-500/20' : 'bg-red-50 hover:bg-red-100 border border-red-200'
      }`}
    >
      <div className="flex flex-col items-center justify-center py-4 gap-1 w-full">
        {/* Count */}
        <p 
          style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}
          className={`mb-2 ${
            color === 'blue' 
              ? isDark ? 'text-blue-400' : 'text-blue-600'
              : color === 'green'
              ? isDark ? 'text-green-400' : 'text-green-600'
              : isDark ? 'text-red-400' : 'text-red-600'
          }`}
        >
          {count}
        </p>
        
        {/* Label */}
        <p 
          style={{ fontSize: '13px', fontWeight: 500, lineHeight: 1.2 }}
          className={`text-center ${
            color === 'blue'
              ? isDark ? 'text-blue-300/80' : 'text-blue-700'
              : color === 'green'
              ? isDark ? 'text-green-300/80' : 'text-green-700'
              : isDark ? 'text-red-300/80' : 'text-red-700'
          }`}
        >
          {title}
        </p>
      </div>
    </motion.button>
  )

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Pill-shaped Header with Back Button */}
      <div className={`sticky top-0 z-20 -mx-6 md:-mx-8 px-6 md:px-8 py-4 ${isDark ? 'bg-dark-bg' : 'bg-light-bg'}`}>
        <div className={`flex items-center justify-between px-5 py-3 rounded-full backdrop-blur-xl border ${isDark ? 'bg-dark-card/90 border-white/10' : 'bg-white/90 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/admin')}
              className={`flex items-center justify-center w-9 h-9 rounded-full transition-all ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-900'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </motion.button>
            <h2 className={`text-lg font-black tracking-wide ${isDark ? 'text-white' : 'text-gray-900'}`}>TECHNICIAN ATTENDANCE</h2>
          </div>
        </div>
      </div>

      {/* Stats Cards - Professional Dashboard Style */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          title="Total Technicians"
          count={totalTechnicians}
          color="blue"
          isActive={activeView === 'total'}
          onClick={() => setActiveView(activeView === 'total' ? null : 'total')}
        />
        <StatCard
          title="Present"
          count={presentTechnicians.length}
          color="green"
          isActive={activeView === 'present'}
          onClick={() => setActiveView(activeView === 'present' ? null : 'present')}
        />
        <StatCard
          title="Absent"
          count={absentTechnicians.length}
          color="red"
          isActive={activeView === 'absent'}
          onClick={() => setActiveView(activeView === 'absent' ? null : 'absent')}
        />
      </div>

      {/* Expanded View Below Stats */}
      <AnimatePresence mode="wait">
        {activeView === 'total' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`rounded-2xl p-5 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">👥</span>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  All Technicians ({totalTechnicians})
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {technicians.length > 0 ? technicians.map((tech, i) => (
                  <motion.div
                    key={tech.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {tech.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {tech.name}
                          </p>
                          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            {tech.phone}
                          </p>
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        todayAttendance.some(att => att.technicianId === tech.id)
                          ? isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                          : isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                      }`}>
                        {todayAttendance.some(att => att.technicianId === tech.id) ? 'Present' : 'Absent'}
                      </span>
                    </div>
                  </motion.div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3">👥</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      No technicians found
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'present' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`rounded-2xl p-5 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">✅</span>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Present Today ({presentTechnicians.length})
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {presentTechnicians.length > 0 ? presentTechnicians.map((tech, i) => {
                  const attendance = todayAttendance.find(att => att.technicianId === tech.id)
                  return (
                    <motion.div
                      key={tech.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                          isDark ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700'
                        }`}>
                          {tech.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {tech.name}
                          </p>
                          <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            {tech.phone}
                          </p>
                        </div>
                        {attendance?.checkOut ? (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                            isDark ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            Complete
                          </span>
                        ) : (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1 ${
                            isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-700'
                          }`}>
                            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
                            Active
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                          <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            Check In
                          </p>
                          <p className={`text-sm font-black ${isDark ? 'text-green-300' : 'text-green-700'}`}>
                            {formatTime(attendance?.checkIn)}
                          </p>
                        </div>
                        <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                          <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            Check Out
                          </p>
                          <p className={`text-sm font-black ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                            {formatTime(attendance?.checkOut)}
                          </p>
                        </div>
                        <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
                          <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                            Duration
                          </p>
                          <p className={`text-sm font-black ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
                            {calculateWorkingHours(attendance?.checkIn, attendance?.checkOut)}
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )
                }) : (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3">🎉</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      No technicians present today
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeView === 'absent' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className={`rounded-2xl p-5 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">❌</span>
                <h3 className={`text-lg font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                  Absent Today ({absentTechnicians.length})
                </h3>
              </div>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {absentTechnicians.length > 0 ? absentTechnicians.map((tech, i) => (
                  <motion.div
                    key={tech.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl p-4 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                      }`}>
                        {tech.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {tech.name}
                        </p>
                        <p className={`text-sm ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                          {tech.phone}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                        isDark ? 'bg-red-500/20 text-red-300' : 'bg-red-100 text-red-700'
                      }`}>
                        Not Marked
                      </span>
                    </div>
                  </motion.div>
                )) : (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3">🎉</p>
                    <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      All technicians are present!
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Technician Selector */}
      <div className={`rounded-2xl p-5 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}>
        <label className={`text-sm font-bold block mb-3 ${isDark ? 'text-white' : 'text-gray-900'}`}>
          Select Technician *
        </label>
        <select
          value={selectedTechnicianId}
          onChange={(e) => {
            setSelectedTechnicianId(e.target.value)
            const tech = technicians.find(t => t.id === e.target.value)
            setSelectedTechnicianName(tech?.name || '')
          }}
          className={`w-full px-4 py-3 rounded-xl text-base font-semibold focus:outline-none focus:ring-2 focus:ring-cyan-500 transition ${
            isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'
          } border`}
        >
          <option value="">Choose a technician...</option>
          {technicians.map(tech => (
            <option key={tech.id} value={tech.id}>
              {tech.name} - {tech.phone}
            </option>
          ))}
        </select>
      </div>

      {/* Period Filter Pills - Only show when technician is selected */}
      {selectedTechnicianId && (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: 'today', label: 'Today' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'custom', label: 'Custom Range' },
          ].map(({ key, label }) => (
            <motion.button
              key={key}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                setPeriodFilter(key)
                if (key === 'custom') setShowDatePicker(true)
              }}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                periodFilter === key
                  ? isDark
                    ? 'bg-blue-500 text-white'
                    : 'bg-blue-600 text-white'
                  : isDark
                  ? 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Custom Date Range Picker */}
      {showDatePicker && periodFilter === 'custom' && selectedTechnicianId && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-4 border ${isDark ? 'bg-dark-card border-white/10' : 'bg-white border-gray-200'}`}
        >
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className={`text-xs font-bold mb-2 block ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Start Date</label>
              <input
                type="date"
                value={customDateRange.start}
                onChange={(e) => setCustomDateRange({ ...customDateRange, start: e.target.value })}
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
                onChange={(e) => setCustomDateRange({ ...customDateRange, end: e.target.value })}
                className={`w-full px-3 py-2 rounded-lg text-sm border transition-all ${
                  isDark
                    ? 'bg-white/5 border-white/10 text-white focus:border-blue-500'
                    : 'bg-white border-gray-200 text-gray-900 focus:border-blue-500'
                } focus:outline-none`}
              />
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowDatePicker(false)}
            className={`w-full py-2 rounded-lg text-sm font-bold transition-all ${
              isDark
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            Apply Range
          </motion.button>
        </motion.div>
      )}

      {/* Present / Absent Summary Cards for week/month/custom */}
      {periodStats && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3"
        >
          <div className={`rounded-2xl p-4 border flex flex-col items-center justify-center gap-1 ${
            isDark ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200'
          }`}>
            <p className={`text-3xl font-black ${
              isDark ? 'text-green-400' : 'text-green-600'
            }`}>{periodStats.present}</p>
            <p className={`text-xs font-bold ${
              isDark ? 'text-green-300/80' : 'text-green-700'
            }`}>Days Present</p>
          </div>
          <div className={`rounded-2xl p-4 border flex flex-col items-center justify-center gap-1 ${
            isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          }`}>
            <p className={`text-3xl font-black ${
              isDark ? 'text-red-400' : 'text-red-600'
            }`}>{periodStats.absent}</p>
            <p className={`text-xs font-bold ${
              isDark ? 'text-red-300/80' : 'text-red-700'
            }`}>Days Absent</p>
          </div>
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
                  {/* Date Header */}
                  <div className={`sticky top-0 z-10 backdrop-blur-sm py-2 px-4 rounded-xl border ${
                    isDark
                      ? 'bg-dark-card/80 border-white/10'
                      : 'bg-white/80 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <h3 className={`text-sm font-black ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {date}
                        </h3>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                        isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'
                      }`}>
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
                        className={`rounded-2xl p-4 shadow-sm border transition-all ${
                          isDark
                            ? 'bg-dark-card border-white/10 hover:border-cyan-500/30 hover:bg-white/5'
                            : 'bg-white border-gray-100 hover:shadow-md hover:border-cyan-200'
                        }`}
                      >
                        <div className="space-y-3">
                          {/* Technician Name */}
                          <div className="flex items-center justify-between">
                            <p className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-900'}`}>
                              {selectedTechnicianName}
                            </p>
                            {record.checkOut ? (
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                                isDark
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                  : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}>
                                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span>Complete</span>
                              </span>
                            ) : (
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 ${
                                isDark
                                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                  : 'bg-amber-100 text-amber-700 border-amber-200'
                              }`}>
                                <svg className="w-3.5 h-3.5 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                                </svg>
                                <span>In Progress</span>
                              </span>
                            )}
                          </div>

                          {/* Time Details */}
                          <div className="grid grid-cols-3 gap-3">
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Check In</p>
                              <p className={`text-sm font-black ${isDark ? 'text-cyan-300' : 'text-cyan-700'}`}>
                                {formatTime(record.checkIn)}
                              </p>
                            </div>
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Check Out</p>
                              <p className={`text-sm font-black ${isDark ? 'text-purple-300' : 'text-purple-700'}`}>
                                {formatTime(record.checkOut)}
                              </p>
                            </div>
                            <div className={`rounded-lg p-3 ${isDark ? 'bg-white/5' : 'bg-gray-50'}`}>
                              <p className={`text-xs font-semibold mb-1 ${isDark ? 'text-white/60' : 'text-gray-600'}`}>Duration</p>
                              <p className={`text-sm font-black ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                                {calculateWorkingHours(record.checkIn, record.checkOut)}
                              </p>
                            </div>
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
                  No attendance records for selected period
                </p>
              </motion.div>
            )}
          </div>
        </AnimatePresence>
      )}


    </div>
  )
}
