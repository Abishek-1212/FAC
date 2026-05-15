import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import PropTypes from 'prop-types'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  const { isDark } = useTheme()
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }
  if (!open) return null
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <motion.div
          className={`relative rounded-3xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto ${isDark ? 'bg-dark-card' : 'bg-white'}`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className={`flex items-center justify-between px-6 py-4 border-b ${isDark ? 'border-dark-border' : 'border-gray-100'}`}>
            <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-800'}`}>{title}</h3>
            <button onClick={onClose} className={`w-8 h-8 rounded-full flex items-center justify-center transition ${isDark ? 'bg-white/5 text-white/60 hover:bg-white/10' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>✕</button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

Modal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node,
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl'])
}
