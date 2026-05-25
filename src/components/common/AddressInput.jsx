import { useTheme } from '../../context/ThemeContext'

export default function AddressInput({ value, onChange, disabled = false }) {
  const { isDark } = useTheme()

  const fields = [
    { key: 'houseNo', label: 'House No', placeholder: 'Example: 12/4', required: false },
    { key: 'building', label: 'Building Name', placeholder: 'Example: ABC Apartments', required: true },
    { key: 'street', label: 'Street Name', placeholder: 'Example: Gandhi Street', required: true },
    { key: 'city', label: 'City', placeholder: 'Example: Chennai', required: true },
    { key: 'pinCode', label: 'PIN Code', placeholder: 'Example: 620019', required: true },
    { key: 'landmark', label: 'Landmark', placeholder: 'Example: Near Bus Stand', required: false },
  ]

  const handleChange = (key, val) => {
    onChange({
      ...value,
      [key]: val,
    })
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {fields.map(field => (
          <div key={field.key} className="">
            <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            <input
              type="text"
              value={value?.[field.key] || ''}
              onChange={e => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              disabled={disabled}
              required={field.required}
              className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:bg-gray-50 ${
                isDark 
                  ? 'bg-white/5 border-white/10 text-white placeholder-white/30' 
                  : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-[0_1px_4px_rgba(0,0,0,0.07)]'
              }`}
            />
          </div>
        ))}
        
        {/* State - Prefilled with Tamil Nadu */}
        <div>
          <label className={`text-xs font-semibold ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
            State
            <span className="text-red-500 ml-1">*</span>
          </label>
          <input
            type="text"
            value={value?.state || 'Tamil Nadu'}
            onChange={e => handleChange('state', e.target.value)}
            disabled={disabled}
            required
            className={`w-full mt-1 border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50 disabled:bg-gray-50 ${
              isDark 
                ? 'bg-white/5 border-white/10 text-white placeholder-white/30' 
                : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400 shadow-[0_1px_4px_rgba(0,0,0,0.07)]'
            }`}
          />
        </div>
      </div>
    </div>
  )
}
