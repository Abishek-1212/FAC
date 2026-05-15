import { motion, AnimatePresence } from 'framer-motion'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
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
          className={`relative bg-white rounded-3xl shadow-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto`}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-800 text-lg">{title}</h3>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition">✕</button>
          </div>
          <div className="px-6 py-5">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
