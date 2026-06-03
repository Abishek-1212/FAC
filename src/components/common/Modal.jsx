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
        className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <motion.div
          className={`relative rounded-[2rem] w-full ${sizes[size]} ${isDark ? 'bg-dark-card' : ''}`}
          style={!isDark ? { background: '#e8f4fb' } : {}}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div
            className="flex items-center justify-between px-6 py-4 border-b rounded-t-[2rem]"
            style={isDark
              ? { borderColor: 'rgba(255,255,255,0.08)' }
              : { background: '#e8f4fb', borderBottom: '1px solid #d4eaf6', boxShadow: 'inset 0 -3px 6px rgba(163,196,215,0.3)' }
            }
          >
            <div className="flex items-center gap-2.5">
              {!isDark && (
                <div style={{ background: '#e8f4fb', borderRadius: '10px', boxShadow: '3px 3px 7px #c5d8e8, -2px -2px 5px #ffffff', padding: '6px' }}>
                  <svg className="w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
              <h3 className={`font-bold text-lg ${isDark ? 'text-white' : 'text-gray-700'}`}>{title}</h3>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition"
              style={isDark
                ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)' }
                : { background: '#e8f4fb', color: '#6b7280', boxShadow: '3px 3px 7px #c5d8e8, -2px -2px 5px #ffffff' }
              }
            >✕</button>
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
