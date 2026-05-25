import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// Utility: Format currency with Rs. prefix (better PDF compatibility)
const formatCurrency = (value) => {
  const amount = Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `Rs. ${amount}`
}

// Utility: Format date safely
const formatDate = (date) => {
  if (!date) return new Date().toLocaleDateString('en-IN')
  if (typeof date === 'string') return date
  if (date.toDate) return date.toDate().toLocaleDateString('en-IN')
  return new Date(date).toLocaleDateString('en-IN')
}

export const generateInvoice = (invoiceData) => {
  // Initialize standard A4 Portrait document
  const doc = new jsPDF('p', 'mm', 'a4')
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - (margin * 2)

  // Extract fresh data mapping matching your business fields
  const {
    invoiceNumber = `FAC-${Date.now()}`,
    serviceId = `SRV-${Math.floor(100000 + Math.random() * 900000)}`,
    status = 'PAID',
    paymentMode = 'Cash',
    customerId = `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName,
    customerPhone,
    customerAddress,
    technicianName,
    serviceDate,
    serviceType,
    problemDescription,
    totalAmount = 0,
    discountType = 'percentage',
    discountValue = 0,
    discountAmount = 0,
    grandTotal = 0,
    amountReceived = 0,
    products = [], // Array of { name, qty }
    inventoryMetrics = { assigned: 0, used: 0, returned: 0 }
  } = invoiceData

  const primaryColor = [6, 182, 212]     // #06B6D4 Cyan/Teal Accent
  const darkText = [31, 41, 55]          // Premium Charcoal Body
  const lightMuted = [107, 114, 128]     // Subdued gray for secondary labels
  const tableBorder = [209, 213, 219]    // Clean structural grids
  const rowHighlight = [240, 253, 250]   // Light cyan tint for alternate row shading

  let currentY = margin

  // ========================================================
  // HEADER SECTION (Logo, Typography & Branch Metadata)
  // ========================================================
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.text('Friends Aqua Care', margin, currentY + 4)

  // Business Contacts & Identifiers (Right side, aligned with Branch Office)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...darkText)
  
  const contactStartX = pageWidth - margin - 60 // Same alignment as Branch Office
  let contactY = currentY
  
  // GSTIN
  doc.text('GSTIN: 33ACDPU6542L1Z9', contactStartX, contactY)
  contactY += 4
  
  // Email
  doc.text('Email: facwatersystems@gmail.com', contactStartX, contactY)
  contactY += 4
  
  // Phone numbers with proper alignment
  doc.text('Phone: +91 99765 55199', contactStartX, contactY)
  contactY += 4
  // Second phone number aligned with first number (after "Phone: ")
  const phoneValueX = contactStartX + doc.getTextWidth('Phone: ')
  doc.text('+91 90955 40660', phoneValueX, contactY)
  contactY += 6 // Extra spacing before date
  
  // Date with proper spacing to avoid overlap
  const computedDate = formatDate(serviceDate)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`Date: ${computedDate}`, contactStartX, contactY)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)

  currentY += 10
  doc.setFont('helvetica', 'oblique')
  doc.setFontSize(10)
  doc.setTextColor(...lightMuted)
  doc.text('Water Purifier Service & Maintenance', margin, currentY)
  
  currentY += 4.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...lightMuted)
  doc.text('Water Purifiers • Water Softeners • Solar Water Heaters • CCTV Cameras', margin, currentY)

  currentY += 8
  
  // Dual Branch Layout Structure
  doc.setLineWidth(0.2)
  doc.setDrawColor(...tableBorder)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 4

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...darkText)
  doc.text('Head Office:', margin, currentY)
  doc.text('Branch Office:', pageWidth - margin - 60, currentY)
  
  currentY += 4
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...lightMuted)
  
  const hoAddress = ['No.25 Railway Station Road,', 'VOC Street, Udumalpet,', 'Tirupur Dt – 642126']
  const boAddress = ['2/290A1 DHRUGANAGAR,', 'Siruvani Main Road, Kalampalayam,', 'Coimbatore – 641010']
  
  for(let i = 0; i < 3; i++) {
    doc.text(hoAddress[i], margin, currentY + (i * 3.5))
    doc.text(boAddress[i], pageWidth - margin - 60, currentY + (i * 3.5))
  }
  
  currentY += 15

  // Elegant Accent Line Divider
  doc.setLineWidth(0.6)
  doc.setDrawColor(...primaryColor)
  doc.line(margin, currentY, pageWidth - margin, currentY)
  currentY += 6

  // ========================================================
  // CUSTOMER & SERVICE INFORMATION (2-Column Grid)
  // ========================================================
  const cardWidth = (contentWidth - 6) / 2
  
  // Format address with commas
  const cleanAddress = typeof customerAddress === 'string' 
    ? customerAddress
    : typeof customerAddress === 'object' && customerAddress
    ? [
        customerAddress.houseNo,
        customerAddress.building,
        customerAddress.street,
        customerAddress.area,
        customerAddress.city,
        customerAddress.pinCode,
        customerAddress.landmark
      ].filter(Boolean).map((val, idx, arr) => idx === arr.length - 1 ? val : val + ',')
       .join('\n')
    : (customerAddress || 'N/A').toString()
  
  // Calculate dynamic height based on address lines
  const splitCustAddress = doc.splitTextToSize(`Address: ${cleanAddress}`, cardWidth - 6)
  const addressLinesCount = splitCustAddress.length
  const baseHeight = 22
  const addressHeight = addressLinesCount * 3.5
  const dynamicCardHeight = Math.max(36, baseHeight + addressHeight + 4)
  
  // Left Column: Customer Card
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, currentY, cardWidth, dynamicCardHeight, 'S')
  doc.setFillColor(...primaryColor)
  doc.rect(margin, currentY, cardWidth, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('CUSTOMER INFORMATION', margin + 3, currentY + 3.5)
  
  doc.setTextColor(...darkText)
  doc.setFontSize(8.5)
  doc.text(`Name: ${customerName}`, margin + 3, currentY + 9)
  doc.text(`Phone: ${customerPhone}`, margin + 3, currentY + 13.5)
  doc.text(`Payment: ${paymentMode}`, margin + 3, currentY + 18)
  doc.text(splitCustAddress, margin + 3, currentY + 22.5)

  // Right Column: Service Card (same height as customer card)
  const rightColumnX = margin + cardWidth + 6
  doc.rect(rightColumnX, currentY, cardWidth, dynamicCardHeight, 'S')
  doc.setFillColor(...primaryColor)
  doc.rect(rightColumnX, currentY, cardWidth, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(255, 255, 255)
  doc.text('SERVICE INFORMATION', rightColumnX + 3, currentY + 3.5)

  doc.setTextColor(...darkText)
  doc.text(`Invoice No: ${invoiceNumber}`, rightColumnX + 3, currentY + 9)
  doc.text(`Technician: ${technicianName || 'Unassigned'}`, rightColumnX + 3, currentY + 13.5)
  doc.text(`Service Type: ${serviceType}`, rightColumnX + 3, currentY + 18)
  
  const cleanProblem = (problemDescription || '').replace(/\n/g, ' ')
  const splitProblem = doc.splitTextToSize(`Problem: ${cleanProblem}`, cardWidth - 6)
  doc.text(splitProblem, rightColumnX + 3, currentY + 22.5)

  currentY += dynamicCardHeight + 8

  // ========================================================
  // LINE ITEMS TABLE (Products with S.No and Quantity only)
  // ========================================================
  const formattedTableData = []
  let serialCounter = 1

  products.forEach((product) => {
    formattedTableData.push([
      serialCounter.toString(),
      product.name || 'Service Item',
      product.qty ? product.qty.toString() : '0'
    ])
    serialCounter++
  })

  autoTable(doc, {
    startY: currentY,
    head: [['S.No', 'Product', 'Quantity']],
    body: formattedTableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
      halign: 'center',
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
      0: { cellWidth: 20, halign: 'center' },
      1: { cellWidth: 130, halign: 'left' },
      2: { cellWidth: 44, halign: 'center' }
    },
    margin: { left: margin, right: margin },
    alternateRowStyles: {
      fillColor: rowHighlight
    }
  })

  currentY = doc.lastAutoTable.finalY + margin

  // Page safety cutoff boundary checkpoint check
  if (currentY > pageHeight - 75) {
    doc.addPage()
    currentY = margin + 10
  }

  const savedSplitPositionBaselineY = currentY

  // ========================================================
  // BANK DETAILS & INVENTORY STATUS (Left Aligned Block)
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



  // Restore alignment anchor baseline pointer for summary values cards
  currentY = savedSplitPositionBaselineY

  // ========================================================
  // SUMMARY CALCULATIONS SECTION (Right Aligned Card)
  // ========================================================
  const summaryLabels = ['Total Amount:', 'Discount:', 'GRAND TOTAL:', 'Amount Received:']
  const summaryValues = [
    formatCurrency(totalAmount),
    formatCurrency(discountAmount),
    formatCurrency(grandTotal),
    formatCurrency(amountReceived)
  ]

  summaryLabels.forEach((label, idx) => {
    const rowY = currentY + (idx * 5)
    const isGrandTotal = idx === 2
    const isAmountReceived = idx === 3
    const isDiscount = idx === 1
    
    if (isGrandTotal) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...primaryColor)
      // Highlight Line Separation
      doc.setLineWidth(0.4)
      doc.setDrawColor(...primaryColor)
      doc.line(pageWidth - margin - 75, rowY - 1, pageWidth - margin, rowY - 1)
      doc.text(label, pageWidth - margin - 72, rowY + 4)
      doc.text(summaryValues[idx], pageWidth - margin, rowY + 4, { align: 'right' })
    } else if (isAmountReceived) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(13, 148, 136) // Green for amount received
      doc.text(label, pageWidth - margin - 72, rowY + 4)
      doc.text(summaryValues[idx], pageWidth - margin, rowY + 4, { align: 'right' })
    } else if (isDiscount && discountAmount > 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(13, 148, 136) // Green for discount
      const discountLabel = discountType === 'percentage' ? `${label} (${discountValue}%)` : label
      doc.text(discountLabel, pageWidth - margin - 72, rowY)
      doc.text(`-${summaryValues[idx]}`, pageWidth - margin, rowY, { align: 'right' })
    } else if (!isDiscount) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...darkText)
      doc.text(label, pageWidth - margin - 72, rowY)
      doc.text(summaryValues[idx], pageWidth - margin, rowY, { align: 'right' })
    }
  })

  // ========================================================
  // SIGNATURE PANELS SECTION
  // ========================================================
  let sigY = pageHeight - 32
  doc.setLineWidth(0.2)
  doc.setDrawColor(...tableBorder)
  
  // Left Signee anchor line
  doc.line(margin, sigY, margin + 40, sigY)
  // Center Signee anchor line
  doc.line((pageWidth / 2) - 20, sigY, (pageWidth / 2) + 20, sigY)
  // Right Signee anchor line
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

  // ========================================================
  // DISPATCH / SAVE EXPORT ACTION
  // ========================================================
  const fileName = `FAC-Invoice-${invoiceNumber}.pdf`
  
  // Execute physical file distribution download stream
  doc.save(fileName)

  // Return contextual metrics payload for application state tracking / Firebase references
  return {
    invoiceNo: invoiceNumber,
    customerName: customerName || 'Customer',
    serviceDate: computedDate,
    totalAmount: grandTotal,
    technician: technicianName || 'Unassigned',
    fileName: fileName,
    documentInstance: doc // Accessible for direct transformations to blob streams for Firebase uploads
  }
}

/**
 * Standard utility link wrapper mapping complex jobs context profiles onto structured inputs
 */
export const generateInvoiceFromJob = (job, selectedProducts = [], serviceCharge = 0, discount = 0, notes = '') => {
  // Safe normalization configuration map
  const normalizedProductsList = (selectedProducts || []).map(item => ({
    name: item.name || '',
    qty: Number(item.qty || 0),
    unit: item.unit || 'Nos',
    price: Number(item.price || 0),
    nestedItems: item.nestedItems || [] // Array of string accessory labels
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