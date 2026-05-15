import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import PropTypes from 'prop-types'

const COLORS_LIGHT = {
  aqua:   { bg: 'bg-aqua-50',   icon: 'bg-aqua-100 text-aqua-600',   value: 'text-aqua-700' },
  green:  { bg: 'bg-emerald-50',icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-700' },
  red:    { bg: 'bg-red-50',    icon: 'bg-red-100 text-red-500',      value: 'text-red-600' },
  yellow: { bg: 'bg-amber-50',  icon: 'bg-amber-100 text-amber-600',  value: 'text-amber-700' },
  purple: { bg: 'bg-violet-50', icon: 'bg-violet-100 text-violet-600',value: 'text-violet-700' },
  blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-100 text-blue-600',    value: 'text-blue-700' },
}

const COLORS_DARK = {
  aqua:   { bg: 'bg-cyan-500/10',   icon: 'bg-cyan-500/20 text-cyan-400',   value: 'text-cyan-400' },
  green:  { bg: 'bg-emerald-500/10',icon: 'bg-emerald-500/20 text-emerald-400', value: 'text-emerald-400' },
  red:    { bg: 'bg-red-500/10',    icon: 'bg-red-500/20 text-red-400',      value: 'text-red-400' },
  yellow: { bg: 'bg-amber-500/10',  icon: 'bg-amber-500/20 text-amber-400',  value: 'text-amber-400' },
  purple: { bg: 'bg-violet-500/10', icon: 'bg-violet-500/20 text-violet-400',value: 'text-violet-400' },
  blue:   { bg: 'bg-blue-500/10',   icon: 'bg-blue-500/20 text-blue-400',    value: 'text-blue-400' },
}

export default function StatCard({ icon, label, value, color = 'aqua', sub }) {
  const { isDark } = useTheme()
  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT
  const c = COLORS[color] || COLORS.aqua
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className={`${c.bg} rounded-2xl p-4 border shadow-sm ${isDark ? 'border-dark-border' : 'border-white'}`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${c.icon}`}>
        {icon}
      </div>
      <p className={`text-2xl font-black ${c.value}`}>{value}</p>
      <p className={`text-sm font-medium mt-0.5 ${isDark ? 'text-white/60' : 'text-gray-500'}`}>{label}</p>
      {sub && <p className={`text-xs mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{sub}</p>}
    </motion.div>
  )
}

StatCard.propTypes = {
  icon: PropTypes.node.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  color: PropTypes.oneOf(['aqua', 'green', 'red', 'yellow', 'purple', 'blue']),
  sub: PropTypes.string
}
