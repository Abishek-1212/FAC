import { forwardRef } from 'react'
import headerLogo from '../../assets/Header_LOGO.png'

// Shared A4 invoice template — used by both technician and admin
// The "Assigned/Used/Returned" box is NOT included here
const InvoicePDF = forwardRef(function InvoicePDF({ inv }, ref) {
  return (
    <div
      ref={ref}
      className="bg-white mx-auto shadow-lg"
      style={{ fontFamily: 'Arial, sans-serif', width: '210mm', minHeight: '297mm', padding: '20mm' }}
    >
      {/* Header */}
      <div className="flex items-center mb-6 border-b-2 border-gray-800 pb-4">
        <img src={headerLogo} alt="Friends Aqua Care" style={{ height: '80px', width: 'auto' }} className="mr-4" />
        <div>
          <h1 className="text-3xl font-black text-gray-900 mb-1">FRIENDS AQUA CARE</h1>
          <p className="text-sm text-gray-700 font-semibold">Water Purifier Sales & Service</p>
          <div className="mt-1 text-xs text-gray-600 space-y-0.5">
            <p>📍 Office Address: Coimbatore, Tamil Nadu</p>
            <p>📞 Phone Number: +91 9876543210</p>
            <p>📧 Email: friendsaquacare@gmail.com</p>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-gray-900 border-b border-gray-300 inline-block px-4 pb-1">
          SERVICE BILL / INVOICE
        </h2>
      </div>

      {/* Bill Info */}
      <div className="flex justify-between mb-6 text-sm">
        <div><span className="font-bold">Bill No:</span> {inv.billNo}</div>
        <div><span className="font-bold">Date:</span> {inv.invoiceDate}</div>
      </div>

      {/* Customer Details */}
      <div className="mb-6 border border-gray-300 rounded p-4">
        <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">CUSTOMER DETAILS</h3>
        <div className="space-y-2 text-sm">
          <div className="flex"><span className="font-bold w-40">Customer Name:</span><span>{inv.customerName}</span></div>
          <div className="flex"><span className="font-bold w-40">Phone Number:</span><span>{inv.customerPhone}</span></div>
          <div className="flex"><span className="font-bold w-40">Location / Address:</span><span>{inv.customerAddress}</span></div>
        </div>
      </div>

      {/* Service Details */}
      <div className="mb-6 border border-gray-300 rounded p-4">
        <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">SERVICE DETAILS</h3>
        <div className="space-y-2 text-sm">
          <div className="flex"><span className="font-bold w-40">Service Type:</span><span>{inv.serviceType}</span></div>
          <div className="flex"><span className="font-bold w-40">Technician Name:</span><span>{inv.technicianName}</span></div>
        </div>
      </div>

      {/* Components Table */}
      <div className="mb-6">
        <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">COMPONENTS USED</h3>
        <table className="w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-3 py-2 text-left font-bold">S.No</th>
              <th className="border border-gray-300 px-3 py-2 text-left font-bold">Component Name</th>
              <th className="border border-gray-300 px-3 py-2 text-center font-bold">Quantity</th>
              <th className="border border-gray-300 px-3 py-2 text-right font-bold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.components && inv.components.length > 0 ? (
              inv.components.map((comp, i) => (
                <tr key={i}>
                  <td className="border border-gray-300 px-3 py-2">{i + 1}</td>
                  <td className="border border-gray-300 px-3 py-2">{comp.name}</td>
                  <td className="border border-gray-300 px-3 py-2 text-center">{comp.quantity}</td>
                  <td className="border border-gray-300 px-3 py-2 text-right">₹{Number(comp.amount).toLocaleString('en-IN')}</td>
                </tr>
              ))
            ) : (
              <tr><td colSpan="4" className="border border-gray-300 px-3 py-2 text-center text-gray-500">No components used</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Details */}
      <div className="mb-6 border border-gray-300 rounded p-4">
        <h3 className="font-black text-gray-900 mb-3 text-sm border-b border-gray-200 pb-2">PAYMENT DETAILS</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="font-bold">Components Cost:</span>
            <span>₹ {(inv.componentsTotal || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">Mode of Payment:</span>
            <span className="font-semibold">{inv.modeOfPayment || '—'}</span>
          </div>
          <div className="flex justify-between border-t-2 border-gray-800 pt-2 mt-2">
            <span className="font-black text-base">Total Bill Amount:</span>
            <span className="font-black text-base">₹ {(inv.billAmount || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold text-green-700">Amount Received:</span>
            <span className="font-bold text-green-700">₹ {(inv.amountReceived || 0).toLocaleString('en-IN')}</span>
          </div>
          {(inv.paymentPending || 0) > 0 && (
            <div className="flex justify-between bg-red-50 p-2 rounded">
              <span className="font-black text-red-700">Payment Pending:</span>
              <span className="font-black text-red-700">₹ {(inv.paymentPending || 0).toLocaleString('en-IN')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signatures */}
      <div className="flex justify-between mt-12 pt-8 border-t border-gray-300">
        <div className="text-center">
          <div className="border-t border-gray-800 w-40 mb-1"></div>
          <p className="text-xs font-bold">Customer Signature</p>
        </div>
        <div className="text-center">
          <div className="border-t border-gray-800 w-40 mb-1"></div>
          <p className="text-xs font-bold">Technician Signature</p>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center mt-8 pt-4 border-t-2 border-gray-800">
        <p className="text-sm font-bold text-gray-900">Thank you for choosing FRIENDS AQUA CARE</p>
      </div>
    </div>
  )
})

export default InvoicePDF
