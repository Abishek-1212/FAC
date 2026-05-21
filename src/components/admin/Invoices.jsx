import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const formatCurrency = (value) => {
  const amount = Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `INR ${amount}`
}

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
  const contentWidth = pageWidth - (margin * 2)

  const {
    invoiceNumber = `FAC-${Date.now()}`,
    serviceId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`,
    status = 'PAID',
    paymentMode = 'UPI',
    customerId = `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName,
    customerPhone,
    customerAddress,
    technicianName,
    technicianName2,
    serviceDate,
    serviceType,
    problemDescription,
    serviceCharge = 0,
    discount = 0,
    tax = 0,
    products = [],
    notes = '',
    inventoryMetrics = { assigned: 0, used: 0, returned: 0 }
  } = invoiceData

  const primaryColor = [6, 182, 212]     
  const darkText = [31, 41, 55]          
  const lightMuted = [107, 114, 128]     
  const tableBorder = [209, 213, 219]    
  const rowHighlight = [240, 253, 250]   

  let currentY = margin

  // ========================================================
  // HEADER SECTION
  // ========================================================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.text('Friends Aqua Care', margin, currentY + 4)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...darkText)
  
  const contactLines = [
    `GSTIN: 33ACDPU6542L1Z9`,
    `Email: facwatersystems@gmail.com`,
    `Phone: +91 99765 55199`,
    `       +91 90955 40660`
  ]
  let contactY = currentY
  contactLines.forEach(line => {
    doc.text(line, pageWidth - margin, contactY, { align: 'right' })
    contactY += 4
  })

  currentY += 10
  doc.setFont('helvetica', 'oblique')
  doc.setFontSize(10)
  doc.setTextColor(...lightMuted)
  doc.text('Water Purifier Service & Maintenance', margin, currentY)
  
  currentY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.text('Water Purifiers • Water Softeners • Solar Water Heaters • CCTV Cameras', margin, currentY)

  currentY += 8
  
  doc.setLineWidth(0.2)
  doc.setDrawColor(...tableBorder)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...darkText)
  doc.text('Head Office:', margin, currentY)
  doc.text('Branch Office:', margin + (contentWidth / 2), currentY)
  
  currentY += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...lightMuted)
  
  const hoAddress = ['No.25 Railway Station Road,', 'VOC Street, Udumalpet,', 'Tirupur Dt – 642126']
  const boAddress = ['2/290A1 DHRUGANAGAR,', 'Siruvani Main Road, Kalampalayam,', 'Coimbatore – 641010']
  
  for(let i = 0; i < 3; i++) {
    doc.text(hoAddress[i], margin, currentY + (i * 3.5))
    doc.text(boAddress[i], margin + (contentWidth / 2), currentY + (i * 3.5))
  }
  
  currentY += 15

  doc.setLineWidth(0.6)
  doc.setDrawColor(...primaryColor)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 6

  // ========================================================
  // FIX 1: INVOICE META BLOCK (Shifted up & fully separated)
  // ========================================================
  const computedDate = formatDate(serviceDate)
  
  // Render invoice meta information horizontally across the top instead of a stacked overlapping box
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, currentY, contentWidth, 8, 'F')
  doc.setLineWidth(0.2)
  doc.setDrawColor(...tableBorder)
  doc.rect(margin, currentY, contentWidth, 8, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(...darkText)
  
  // Single row layout metrics calculation
  doc.text(`Invoice No: ${invoiceNumber}`, margin + 3, currentY + 5.5)
  doc.text(`Date: ${computedDate}`, margin + 45, currentY + 5.5)
  doc.text(`Service ID: ${serviceId}`, margin + 85, currentY + 5.5)
  doc.text(`Status: ${status}`, margin + 130, currentY + 5.5)
  doc.text(`Payment: ${paymentMode}`, margin + 160, currentY + 5.5)

  currentY += 14 // Drop safely below the meta block row

  // ========================================================
  // CUSTOMER & SERVICE INFORMATION INFORMATION
  // ========================================================
  const cardWidth = (contentWidth - 6) / 2
  const cardHeight = 38
  
  // Left Column: Customer Card
  doc.setDrawColor(...tableBorder)
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, currentY, cardWidth, cardHeight, 'S')
  doc.setFillColor(...primaryColor)
  doc.rect(margin, currentY, cardWidth, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('CUSTOMER INFORMATION', margin + 3, currentY + 3.5)
  
  doc.setTextColor(...darkText)
  doc.setFontSize(8.5)
  doc.text(`Customer ID: ${customerId}`, margin + 3, currentY + 10)
  doc.text(`Name: ${customerName}`, margin + 3, currentY + 15)
  doc.text(`Phone: ${customerPhone}`, margin + 3, currentY + 20)
  
  const cleanAddress = (customerAddress || '').replace(/\n/g, ' ')
  const splitCustAddress = doc.splitTextToSize(`Address: ${cleanAddress}`, cardWidth - 6)
  doc.text(splitCustAddress, margin + 3, currentY + 25)

  // Right Column: Service Card (Now clean and completely overlap-free)
  const rightColumnX = margin + cardWidth + 6
  doc.setFillColor(255, 255, 255)
  doc.rect(rightColumnX, currentY, cardWidth, cardHeight, 'S')
  doc.setFillColor(...primaryColor)
  doc.rect(rightColumnX, currentY, cardWidth, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('SERVICE INFORMATION', rightColumnX + 3, currentY + 3.5)

  doc.setTextColor(...darkText)
  doc.text(`Technician: ${technicianName || 'Unassigned'}`, rightColumnX + 3, currentY + 10)
  if (technicianName2) {
    doc.text(`Technician 2: ${technicianName2}`, rightColumnX + 3, currentY + 13)
    doc.text(`Service Type: ${serviceType}`, rightColumnX + 3, currentY + 16)
  } else {
    doc.text(`Service Type: ${serviceType}`, rightColumnX + 3, currentY + 15)
  }
  
  const cleanProblem = (problemDescription || '').replace(/\n/g, ' ')
  const splitProblem = doc.splitTextToSize(`Problem: ${cleanProblem}`, cardWidth - 6)
  const problemY = technicianName2 ? currentY + 23 : currentY + 20
  doc.text(splitProblem, rightColumnX + 3, problemY)
  
  const parsedDate = serviceDate ? new Date(serviceDate) : new Date()
  parsedDate.setDate(parsedDate.getDate() + 90)
  const nextServiceDateStr = parsedDate.toLocaleDateString('en-IN')

  const serviceDateY = technicianName2 ? currentY + 33 : currentY + 30
  const nextServiceY = technicianName2 ? currentY + 38 : currentY + 35
  doc.text(`Service Date: ${computedDate}`, rightColumnX + 3, serviceDateY)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...primaryColor)
  doc.text(`Next Service Due: ${nextServiceDateStr}`, rightColumnX + 3, nextServiceY)

  currentY += cardHeight + 8

  // ========================================================
  // LINE ITEMS TABLE (FIX 3: Adjusted Widths)
  // ========================================================
  const formattedTableData = []
  let serialCounter = 1

  products.forEach((product) => {
    const itemTotal = Number(product.qty || 0) * Number(product.price || 0)
    formattedTableData.push([
      serialCounter.toString(),
      product.name || 'Service Item',
      product.qty ? product.qty.toString() : '0',
      product.unit || 'Nos',
      formatCurrency(product.price),
      formatCurrency(itemTotal)
    ])
    serialCounter++

    if (product.nestedItems && product.nestedItems.length > 0) {
      const inlineComponentsText = `Included Accessories: ${product.nestedItems.join('  •  ')}`
      formattedTableData.push(['', inlineComponentsText, '', '', '', ''])
    }
  })

  autoTable(doc, {
    startY: currentY,
    head: [['S.No', 'Product / Particular', 'Quantity', 'Unit', 'Unit Price', 'Amount']],
    body: formattedTableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'left',
      valign: 'middle',
      cellPadding: 4,
      lineColor: primaryColor,
      lineWidth: 0.1
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: darkText,
      cellPadding: 4,
      lineColor: tableBorder,
      lineWidth: 0.1,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' },
      1: { cellWidth: 78, halign: 'left' },
      2: { cellWidth: 22, halign: 'center' }, // Expanded slightly to prevent "Quantity" breaking labels
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 30, halign: 'right' },
      5: { cellWidth: 29, halign: 'right' }
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: rowHighlight
    },
    didParseCell: function(data) {
      if (data.row.section === 'body' && data.column.index === 1) {
        if (data.cell.raw.startsWith('Included Accessories:')) {
          data.cell.styles.fontStyle = 'italic'
          data.cell.styles.fontSize = 7.5
          data.cell.styles.textColor = [13, 148, 136] 
          data.cell.styles.fillColor = [255, 255, 255] 
        }
      }
      if (data.row.section === 'body' && data.row.raw[0] === '') {
        data.cell.styles.fillColor = [255, 255, 255]
      }
    }
  })

  currentY = doc.lastAutoTable.finalY + margin

  if (currentY > pageHeight - 75) {
    doc.addPage()
    currentY = margin + 10
  }

  const savedSplitPositionBaselineY = currentY

  // ========================================================
  // BANK DETAILS & INVENTORY STATUS (FIX 2: Replaced Unicode Checkmark)
  // ========================================================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...primaryColor)
  doc.text('OUR BANK DETAILS', margin, currentY)
  
  currentY += 4.5
  doc.setFontSize(8)
  doc.setTextColor(...darkText)
  const bankKeys = ['Account Name:', 'Account Number:', 'Bank:', 'Branch:', 'IFSC:']
  const bankVals = ['FRIENDS AQUA CARE', '637301010050288', 'UNION BANK', 'Udumalpet', 'UBIN0563731']
  
  bankKeys.forEach((key, idx) => {
    doc.setFont('helvetica', 'bold')
    doc.text(key, margin, currentY + (idx * 4))
    doc.setFont('helvetica', 'normal')
    doc.text(bankVals[idx], margin + 28, currentY + (idx * 4))
  })

  currentY += 24
  doc.setFillColor(248, 250, 252)
  doc.rect(margin, currentY, 65, 14, 'F')
  doc.setDrawColor(...tableBorder)
  doc.rect(margin, currentY, 65, 14, 'S')
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...darkText)
  doc.text(`Assigned: ${inventoryMetrics.assigned}   |   Used: ${inventoryMetrics.used}   |   Returned: ${inventoryMetrics.returned}`, margin + 3, currentY + 5)
  
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(13, 148, 136)
  // Replaced unicode character with standard text string to prevent string corruption
  doc.text('Status: Inventory Updated', margin + 3, currentY + 10)

  currentY = savedSplitPositionBaselineY

  // ========================================================
  // SUMMARY CALCULATIONS SECTION
  // ========================================================
  const calculatedItemsTotal = products.reduce((sum, p) => sum + (Number(p.qty || 0) * Number(p.price || 0)), 0)
  const finalGrandTotalValue = (calculatedItemsTotal + Number(serviceCharge)) - Number(discount) + Number(tax)

  const summaryLabels = ['Products Total:', 'Service Charge:', 'Discount:', 'Tax:', 'GRAND TOTAL:']
  const summaryValues = [
    formatCurrency(calculatedItemsTotal),
    formatCurrency(serviceCharge),
    formatCurrency(discount),
    formatCurrency(tax),
    formatCurrency(finalGrandTotalValue)
  ]

  summaryLabels.forEach((label, idx) => {
    const rowY = currentY + (idx * 5)
    const isTotal = idx === summaryLabels.length - 1
    
    if (isTotal) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...primaryColor)
      doc.setLineWidth(0.4)
      doc.setDrawColor(...primaryColor)
      doc.line(pageWidth - margin - 75, rowY - 1, pageWidth - margin, rowY - 1)
      doc.text(label, pageWidth - margin - 72, rowY + 4)
      doc.text(summaryValues[idx], pageWidth - margin, rowY + 4, { align: 'right' })
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...darkText)
      doc.text(label, pageWidth - margin - 72, rowY)
      doc.text(summaryValues[idx], pageWidth - margin, rowY, { align: 'right' })
    }
  })

  if (notes && notes.trim()) {
    currentY += 32
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...darkText)
    doc.text('Remarks/Notes:', margin, currentY)
    doc.setFont('helvetica', 'normal')
    const splitNotesText = doc.splitTextToSize(notes, contentWidth)
    doc.text(splitNotesText, margin, currentY + 3.5)
  }

  // ========================================================
  // SIGNATURE PANELS SECTION
  // ========================================================
  let sigY = pageHeight - 32
  doc.setLineWidth(0.2)
  doc.setDrawColor(...tableBorder)
  
  doc.line(margin, sigY, margin + 40, sigY)
  doc.line((pageWidth / 2) - 20, sigY, (pageWidth / 2) + 20, sigY)
  doc.line(pageWidth - margin - 45, sigY, pageWidth - margin, sigY)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...darkText)
  doc.text('Receiver Signature', margin + 2, sigY + 4)
  doc.text('Customer Signature', (pageWidth / 2), sigY + 4, { align: 'center' })
  
  doc.setFont('helvetica', 'bold')
  doc.text('Authorized Signature', pageWidth - margin - 43, sigY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('For Friends Aqua Care', pageWidth - margin - 43, sigY + 7)

  // ========================================================
  // FOOTER BANNER STRIP
  // ========================================================
  const footerHeight = 12
  doc.setFillColor(...primaryColor)
  doc.rect(0, pageHeight - footerHeight, pageWidth, footerHeight, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('Water Purifier  •  Water Softener  •  Solar Water Heater  •  CCTV Camera', pageWidth / 2, pageHeight - 7.5, { align: 'center' })
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.text('Thank you for choosing Friends Aqua Care.  |  For service support: +91 99765 55199', pageWidth / 2, pageHeight - 3.5, { align: 'center' })

  const fileName = `FAC-Invoice-${invoiceNumber}.pdf`
  doc.save(fileName)

  return {
    invoiceNo: invoiceNumber,
    customerName: customerName || 'Customer',
    serviceDate: computedDate,
    totalAmount: finalGrandTotalValue,
    technician: technicianName || 'Unassigned',
    fileName: fileName,
    documentInstance: doc 
  }
}

export const generateInvoiceFromJob = (job, selectedProducts = [], serviceCharge = 0, discount = 0, notes = '') => {
  const normalizedProductsList = (selectedProducts || []).map(item => ({
    name: item.name || '',
    qty: Number(item.qty || 0),
    unit: item.unit || 'Nos',
    price: Number(item.price || 0),
    nestedItems: item.nestedItems || [] 
  }))

  const metricsSummary = {
    assigned: normalizedProductsList.length,
    used: normalizedProductsList.filter(p => p.qty > 0).length,
    returned: Math.max(0, normalizedProductsList.length - normalizedProductsList.filter(p => p.qty > 0).length)
  }

  const invoiceDataPayload = {
    invoiceNumber: `FAC-${Date.now()}`,
    serviceId: job.id || job.serviceId || `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
    status: job.paymentStatus || 'PAID',
    paymentMode: job.paymentMode || 'Cash',
    customerId: job.customerId || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: job.customerName || 'Customer',
    customerPhone: job.customerPhone || '',
    customerAddress: job.customerAddress || '',
    technicianName: job.technicianName || 'Unassigned',
    serviceDate: job.createdAt || new Date(),
    serviceType: job.serviceType || 'General Service',
    problemDescription: job.problemDescription || 'N/A',
    serviceCharge: Number(serviceCharge),
    discount: Number(discount),
    tax: 0, 
    products: normalizedProductsList,
    inventoryMetrics: metricsSummary,
    notes: notes
  }

  return generateInvoice(invoiceDataPayload)
}

export default function Invoices() {
  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h2 className="text-2xl font-black text-gray-900">Invoices</h2>
        <p className="text-sm mt-0.5 text-gray-400">Invoices are generated from completed service jobs</p>
      </div>
      <div className="rounded-2xl p-12 text-center border border-dashed bg-white border-gray-200">
        <p className="text-4xl mb-3">📄</p>
        <p className="text-sm font-medium text-gray-400">Invoices are generated when you complete a service job</p>
      </div>
    </div>
  )
}