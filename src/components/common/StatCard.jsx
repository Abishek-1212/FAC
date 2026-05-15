export default function StatCard({ icon, label, value, color = 'aqua', sub }) {
  const colors = {
    aqua: 'bg-aqua-50 text-aqua-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    yellow: 'bg-yellow-50 text-yellow-700',
    purple: 'bg-purple-50 text-purple-700',
    blue: 'bg-blue-50 text-blue-700',
  }
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-black text-gray-800">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}
