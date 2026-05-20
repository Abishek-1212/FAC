import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Utility: Format currency properly
const formatCurrency = (value) => {
  const amount = Number(value || 0).toLocaleString('en-IN')
  return `INR ${amount}`
}

// Utility: Format date properly
const formatDate = (date) => {
  if (!date) return new Date().toLocaleDateString('en-IN')
  if (typeof date === 'string') return date
  if (date.toDate) return date.toDate().toLocaleDateString('en-IN')
  return new Date(date).toLocaleDateString('en-IN')
}

export const generateInvoice = (invoiceData) => {
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2

  const {
    invoiceNumber,
    customerName,
    customerPhone,
    customerAddress,
    technicianName,
    serviceDate,
    serviceType,
    problemDescription,
    serviceCharge = 0,
    products = [],
    notes = '',
  } = invoiceData

  const accentColor = [6, 182, 212]
  const darkGray = [45, 45, 45]
  const lightGray = [120, 120, 120]
  const borderGray = [220, 220, 220]
  const alternateRowColor = [245, 250, 255]

  let currentY = margin

  // ============ HEADER SECTION ============
  doc.setFontSize(28)
  doc.setTextColor(...accentColor)
  doc.setFont(undefined, 'bold')
  doc.text('Friends Aqua Care', margin, currentY)
  currentY += 8

  doc.setFontSize(10)
  doc.setTextColor(...lightGray)
  doc.setFont(undefined, 'normal')
  doc.text('RO Water Purifier Service & Maintenance', margin, currentY)
  currentY += 6

  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.8)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 8

  // Invoice details (right aligned)
  const invoiceDate = formatDate(serviceDate)
  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'normal')
  
  const invoiceNumberText = `Invoice #: ${invoiceNumber}`
  const invoiceDateText = `Date: ${invoiceDate}`
  
  const invoiceNumberWidth = doc.getTextWidth(invoiceNumberText)
  const invoiceDateWidth = doc.getTextWidth(invoiceDateText)
  
  doc.text(invoiceNumberText, pageWidth - margin - invoiceNumberWidth, currentY)
  currentY += 5
  doc.text(invoiceDateText, pageWidth - margin - invoiceDateWidth, currentY)
  currentY += 10

  // ============ CUSTOMER INFORMATION SECTION ============
  doc.setFontSize(11)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'bold')
  doc.text('CUSTOMER INFORMATION', margin, currentY)
  currentY += 6

  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'normal')
  doc.text(`Name: ${customerName}`, margin, currentY)
  currentY += 5
  doc.text(`Phone: ${customerPhone}`, margin, currentY)
  currentY += 5
  
  const addressLines = doc.splitTextToSize(`Address: ${customerAddress}`, contentWidth - 5)
  doc.text(addressLines, margin, currentY)
  currentY += addressLines.length * 4 + 8

  // ============ SERVICE INFORMATION SECTION ============
  doc.setFontSize(11)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'bold')
  doc.text('SERVICE INFORMATION', margin, currentY)
  currentY += 6

  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'normal')
  doc.text(`Technician: ${technicianName}`, margin, currentY)
  currentY += 5
  doc.text(`Service Type: ${serviceType}`, margin, currentY)
  currentY += 5
  
  const problemLines = doc.splitTextToSize(`Problem: ${problemDescription}`, contentWidth - 5)
  doc.text(problemLines, margin, currentY)
  currentY += problemLines.length * 4 + 10

  // ============ PREPARE SAFE PRODUCTS DATA ============
  const safeProducts = products.map(item => ({
    name: item.name || '',
    qty: Number(item.qty || 0),
    price: Number(item.price || 0),
    total: Number(item.qty || 0) * Number(item.price || 0),
  }))

  // ============ PRODUCTS TABLE ============
  const tableData = safeProducts.map(item => [
    item.name,
    item.qty.toString(),
    formatCurrency(item.price),
    formatCurrency(item.total),
  ])

  autoTable(doc, {
    startY: currentY,
    head: [['Product', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: accentColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left',
      valign: 'middle',
      cellPadding: 5,
      lineColor: accentColor,
      lineWidth: 0.5,
      overflow: 'linebreak',
    },
    bodyStyles: {
      fontSize: 10,
      textColor: darkGray,
      cellPadding: 5,
      lineColor: borderGray,
      lineWidth: 0.3,
      valign: 'middle',
      overflow: 'linebreak',
    },
    columnStyles: {
      0: { cellWidth: 70, halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 45, halign: 'right' },
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: alternateRowColor,
    },
  })

  currentY = doc.lastAutoTable.finalY + 12

  // ============ SUMMARY SECTION ============
  const productsTotal = safeProducts.reduce((sum, item) => sum + item.total, 0)
  const serviceCost = Number(serviceCharge || 0)
  const grandTotal = productsTotal + serviceCost

  doc.setFontSize(9)
  doc.setTextColor(...darkGray)
  doc.setFont(undefined, 'normal')

  // Products Total
  doc.text('Products Total:', margin, currentY)
  doc.text(formatCurrency(productsTotal), pageWidth - margin - 5, currentY, { align: 'right' })
  currentY += 6

  // Service Charge
  doc.text('Service Charge:', margin, currentY)
  doc.text(formatCurrency(serviceCost), pageWidth - margin - 5, currentY, { align: 'right' })
  currentY += 8

  // Divider line
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(0.8)
  doc.line(margin, currentY - 2, pageWidth - margin, currentY - 2)
  currentY += 6

  // Grand Total
  doc.setFontSize(12)
  doc.setTextColor(...accentColor)
  doc.setFont(undefined, 'bold')
  doc.text('GRAND TOTAL:', margin, currentY)
  doc.text(formatCurrency(grandTotal), pageWidth - margin - 5, currentY, { align: 'right' })

  // ============ NOTES SECTION ============
  if (notes && notes.trim()) {
    currentY += 12
    doc.setFontSize(10)
    doc.setTextColor(...darkGray)
    doc.setFont(undefined, 'bold')
    doc.text('NOTES:', margin, currentY)
    currentY += 5

    doc.setFontSize(8)
    doc.setTextColor(...lightGray)
    doc.setFont(undefined, 'normal')
    const splitNotes = doc.splitTextToSize(notes, contentWidth)
    doc.text(splitNotes, margin, currentY)
  }

  // ============ FOOTER ============
  doc.setFontSize(8)
  doc.setTextColor(...lightGray)
  doc.setFont(undefined, 'normal')
  doc.text('Thank you for choosing Friends Aqua Care', pageWidth / 2, pageHeight - 10, { align: 'center' })

  // ============ SAVE PDF ============
  const fileName = `FAC-Invoice-${customerName.replace(/\s+/g, '-')}-${invoiceNumber}.pdf`
  doc.save(fileName)
}

export const generateInvoiceFromJob = (job, products, serviceCharge = 0, notes = '') => {
  const invoiceNumber = `FAC-${Date.now()}`
  const invoiceDate = formatDate(job.createdAt)

  // Ensure all products have numeric values
  const safeProducts = (products || []).map(p => ({
    name: p.name || '',
    qty: Number(p.qty || 0),
    price: Number(p.price || 0),
  }))

  const invoiceData = {
    invoiceNumber,
    customerName: job.customerName || 'Customer',
    customerPhone: job.customerPhone || '',
    customerAddress: job.customerAddress || '',
    technicianName: job.technicianName || 'Unassigned',
    serviceDate: invoiceDate,
    serviceType: job.serviceType || '',
    problemDescription: job.problemDescription || '',
    serviceCharge: Number(serviceCharge || 0),
    products: safeProducts,
    notes: notes || '',
  }

  generateInvoice(invoiceData)
}
