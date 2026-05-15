import { useEffect, useState, useRef } from 'react'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../../firebase'
import { useAuth } from '../../context/AuthContext'
import Modal from '../common/Modal'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

export default function CustomerInvoices() {
  const { profile } = useAuth()
  const [invoices, setInvoices] = useState([])
  const [selected, setSelected] = useState(null)
  const invoiceRef = useRef(null)

  useEffect(() => {
    if (!profile?.phone) return
    return onSnapshot(query(collection(db, 'invoices'), where('customerPhone', '==', profile.phone)), snap => {
      setInvoices(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.generatedDate?.seconds || 0) - (a.generatedDate?.seconds || 0)))
    })
  }, [profile])

  const downloadPDF = async () => {
    if (!invoiceRef.current) return
    const canvas = await html2canvas(invoiceRef.current, { scale: 2 })
    const pdf = new jsPDF('p', 'mm', 'a4')
    const imgData = canvas.toDataURL('image/png')
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
    pdf.save(`invoice-${selected.id}.pdf`)
  }

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      <h2 className="text-xl font-black text-gray-800">My Invoices</h2>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-100">
          <p className="text-4xl mb-3">🧾</p>
          <p className="text-gray-500 text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {invoices.map(inv => (
            <div key={inv.id} onClick={() => setSelected(inv)} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 cursor-pointer hover:border-aqua-200 transition">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800">Service Invoice</p>
                  <p className="text-xs text-gray-500 mt-0.5">Warranty: {inv.warrantyMonths} months</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {inv.generatedDate?.toDate?.()?.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) || ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-aqua-600">₹{Number(inv.totalAmount).toLocaleString('en-IN')}</p>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${inv.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {inv.paymentStatus}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Invoice" size="lg">
        {selected && (
          <div className="space-y-4">
            <div ref={invoiceRef} className="bg-white p-4 rounded-xl border border-gray-100">
              <div className="text-center mb-4">
                <h2 className="text-xl font-black text-aqua-700">💧 Friends Aqua Care</h2>
                <p className="text-xs text-gray-500">RO Water Purifier Service</p>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm mb-4">
                <div><p className="text-gray-500 text-xs">Customer</p><p className="font-semibold">{selected.customerName}</p></div>
                <div><p className="text-gray-500 text-xs">Phone</p><p className="font-semibold">{selected.customerPhone}</p></div>
                <div><p className="text-gray-500 text-xs">Warranty</p><p className="font-semibold">{selected.warrantyMonths} months</p></div>
                <div><p className="text-gray-500 text-xs">Status</p><p className="font-semibold capitalize">{selected.paymentStatus}</p></div>
              </div>
              <table className="w-full text-sm mb-4">
                <thead><tr className="border-b border-gray-200"><th className="text-left py-1 text-xs text-gray-500">Item</th><th className="text-center py-1 text-xs text-gray-500">Qty</th><th className="text-right py-1 text-xs text-gray-500">Amount</th></tr></thead>
                <tbody>
                  {(selected.items || []).map((item, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      <td className="py-1.5">{item.productName}</td>
                      <td className="text-center py-1.5">{item.quantity}</td>
                      <td className="text-right py-1.5">₹{(item.quantity * item.unitPrice).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  <tr><td className="py-1.5 text-gray-500">Service Charge</td><td></td><td className="text-right py-1.5">₹{Number(selected.serviceCharge).toLocaleString('en-IN')}</td></tr>
                </tbody>
                <tfoot><tr className="border-t-2 border-gray-200"><td colSpan={2} className="py-2 font-black">Total</td><td className="text-right py-2 font-black text-aqua-700">₹{Number(selected.totalAmount).toLocaleString('en-IN')}</td></tr></tfoot>
              </table>
            </div>
            <button onClick={downloadPDF} className="w-full bg-aqua-500 text-white rounded-xl py-3 text-sm font-bold hover:bg-aqua-600 transition">
              📥 Download PDF
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}
