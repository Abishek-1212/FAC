import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUrl from '../assets/Header_LOGO.png'

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
  console.log('\n' + '='.repeat(80))
  console.log('GENERATEINVOICE CALLED WITH DATA:')
  console.log('='.repeat(80))
  console.log('invoiceNumber:', invoiceData.invoiceNumber)
  console.log('customerName:', invoiceData.customerName)
  console.log('totalAmount:', invoiceData.totalAmount)
  console.log('discountAmount:', invoiceData.discountAmount)
  console.log('grandTotal:', invoiceData.grandTotal)
  console.log('amountReceived:', invoiceData.amountReceived)
  console.log('products count:', invoiceData.products?.length || 0)
  if (invoiceData.products && invoiceData.products.length > 0) {
    console.log('PRODUCTS ARRAY:')
    invoiceData.products.forEach((p, i) => {
      console.log(`  [${i}] ${p.name} | qty: ${p.qty} | price: ${p.price}`)
    })
  } else {
    console.error('WARNING: NO PRODUCTS IN GENERATEINVOICE DATA!')
  }
  console.log('='.repeat(80) + '\n')
  
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
    products = [],
    inventoryMetrics = { assigned: 0, used: 0, returned: 0 },
    isSalesInvoice = false
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
  // Logo top-left
  try {
    doc.setDrawColor(255, 255, 255)
    doc.setLineWidth(1.5)
    doc.rect(margin - 1, currentY - 1, 14, 14, 'S')
    doc.addImage(logoUrl, 'PNG', margin, currentY, 12, 12)
  } catch (e) {
    // logo failed to load, skip
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...primaryColor)
  doc.text('Friends Aqua Care', margin + 15, currentY + 8)

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

  currentY += 18
  doc.setFont('helvetica', 'italic')
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
    ? customerAddress.split(', ').filter(Boolean).join('\n')
    : typeof customerAddress === 'object' && customerAddress
    ? [
        customerAddress.houseNo,
        customerAddress.building,
        customerAddress.street,
        customerAddress.locality,
        customerAddress.city,
        customerAddress.state,
        customerAddress.pinCode,
        customerAddress.landmark
      ].filter(Boolean).join('\n')
    : (customerAddress || 'N/A').toString()
  
  // Calculate dynamic height based on address lines
  const addressLabel = 'Address: '
  const addressLabelWidth = doc.getStringUnitWidth(addressLabel) * 8.5 / doc.internal.scaleFactor
  const addressIndentWidth = cardWidth - 6 - addressLabelWidth
  const splitCustAddress = doc.splitTextToSize(cleanAddress, addressIndentWidth)
  const addressLinesCount = splitCustAddress.length + 1
  const baseHeight = 22
  const addressHeight = addressLinesCount * 3.5
  const dynamicCardHeight = Math.max(36, baseHeight + addressHeight + 4)
  
  const salesCardHeight = 28
  const cardHeight = isSalesInvoice ? salesCardHeight : dynamicCardHeight
  const cardW = cardWidth

  // Customer Card
  doc.setFillColor(255, 255, 255)
  doc.rect(margin, currentY, cardW, cardHeight, 'S')
  doc.setFillColor(...primaryColor)
  doc.rect(margin, currentY, cardW, 5, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(255, 255, 255)
  doc.text('CUSTOMER INFORMATION', margin + 3, currentY + 3.5)

  doc.setTextColor(...darkText)
  doc.setFontSize(8.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Name: ', margin + 3, currentY + 9)
  doc.setFont('helvetica', 'normal')
  doc.text(customerName, margin + 3 + doc.getStringUnitWidth('Name: ') * 8.5 / doc.internal.scaleFactor + 1, currentY + 9)
  doc.setFont('helvetica', 'bold')
  doc.text('Phone: ', margin + 3, currentY + 13.5)
  doc.setFont('helvetica', 'normal')
  doc.text(customerPhone, margin + 3 + doc.getStringUnitWidth('Phone: ') * 8.5 / doc.internal.scaleFactor + 1, currentY + 13.5)
  doc.setFont('helvetica', 'bold')
  doc.text('Payment: ', margin + 3, currentY + 18)
  doc.setFont('helvetica', 'normal')
  doc.text(paymentMode, margin + 3 + doc.getStringUnitWidth('Payment: ') * 8.5 / doc.internal.scaleFactor + 1, currentY + 18)
  if (!isSalesInvoice) {
    const addrStartX = margin + 3
    const addrStartY = currentY + 22.5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.text('Address:', addrStartX, addrStartY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    const addrValueX = addrStartX + doc.getStringUnitWidth('Address: ') * 8.5 / doc.internal.scaleFactor + 3
    splitCustAddress.forEach((line, i) => {
      doc.text(line, addrValueX, addrStartY + (i * 3.5))
    })
  }

  // Service Card — only for technician invoices
  if (!isSalesInvoice) {
    const rightColumnX = margin + cardWidth + 6
    doc.rect(rightColumnX, currentY, cardWidth, cardHeight, 'S')
    doc.setFillColor(...primaryColor)
    doc.rect(rightColumnX, currentY, cardWidth, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(255, 255, 255)
    doc.text('SERVICE INFORMATION', rightColumnX + 3, currentY + 3.5)
    doc.setTextColor(...darkText)
    doc.setFontSize(8.5)
    const svcLabelX = rightColumnX + 3
    const svcFields = [
      { label: 'Invoice No: ', value: invoiceNumber, y: currentY + 9 },
      { label: 'Technician: ', value: technicianName || 'Unassigned', y: currentY + 13.5 },
      { label: 'Service Type: ', value: serviceType, y: currentY + 18 },
    ]
    svcFields.forEach(({ label, value, y }) => {
      doc.setFont('helvetica', 'bold')
      doc.text(label, svcLabelX, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(value), svcLabelX + doc.getStringUnitWidth(label) * 8.5 / doc.internal.scaleFactor + 1, y)
    })
    doc.setFont('helvetica', 'bold')
    const cleanProblem = (problemDescription || '').replace(/\n/g, ' ').trim()
    if (cleanProblem) {
      doc.text('Problem: ', svcLabelX, currentY + 22.5)
      doc.setFont('helvetica', 'normal')
      const probValueX = svcLabelX + doc.getStringUnitWidth('Problem: ') * 8.5 / doc.internal.scaleFactor + 1
      const splitProblem = doc.splitTextToSize(cleanProblem, cardWidth - 6 - (probValueX - svcLabelX))
      doc.text(splitProblem, probValueX, currentY + 22.5)
    }
  }

  currentY += cardHeight + 8

  // ========================================================
  // LINE ITEMS TABLE
  // ========================================================
  const formattedTableData = []
  let serialCounter = 1

  if (isSalesInvoice) {
    products.forEach((product) => {
      const qty = Number(product.qty) || 0
      const unitPrice = Number(product.price) || 0
      const totalPrice = qty * unitPrice
      formattedTableData.push([
        serialCounter.toString(),
        product.category || '',
        product.name || 'Item',
        qty.toString(),
        `Rs. ${unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Rs. ${totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ])
      serialCounter++
    })
    autoTable(doc, {
      startY: currentY,
      head: [['S.No', 'Category', 'Product', 'Qty', 'Unit Price', 'Total']],
      body: formattedTableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle', cellPadding: 4, lineColor: primaryColor, lineWidth: 0.1 },
      bodyStyles: { fontSize: 8.5, textColor: darkText, cellPadding: 4, lineColor: tableBorder, lineWidth: 0.1, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 28, halign: 'left' },
        2: { cellWidth: 56, halign: 'left' },
        3: { cellWidth: 18, halign: 'center' },
        4: { cellWidth: 40, halign: 'right' },
        5: { cellWidth: 37, halign: 'right' }
      },
      margin: { left: margin, right: margin },
      alternateRowStyles: { fillColor: rowHighlight }
    })
  } else {
    products.forEach((product) => {
      const qty = Number(product.qty) || 0
      let unitPrice = Number(product.price) || 0
      
      // If price is 0 or missing, try to derive from amount field if available
      if (unitPrice === 0 && product.amount && qty > 0) {
        unitPrice = Math.round((Number(product.amount) / qty) * 100) / 100
      }
      
      const totalPrice = qty * unitPrice
      const productName = product.name || product.productName || 'Service Item'
      formattedTableData.push([
        serialCounter.toString(),
        productName,
        qty.toString(),
        `Rs. ${unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        `Rs. ${totalPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      ])
      serialCounter++
    })
    autoTable(doc, {
      startY: currentY,
      head: [['S.No', 'Product', 'Qty', 'Unit Price', 'Total']],
      body: formattedTableData,
      theme: 'grid',
      headStyles: { fillColor: primaryColor, textColor: [255,255,255], fontStyle: 'bold', fontSize: 9, halign: 'center', valign: 'middle', cellPadding: 4, lineColor: primaryColor, lineWidth: 0.1 },
      bodyStyles: { fontSize: 8.5, textColor: darkText, cellPadding: 4, lineColor: tableBorder, lineWidth: 0.1, valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 14, halign: 'center' },
        1: { cellWidth: 78, halign: 'left' },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 45, halign: 'center' },
        4: { cellWidth: 40, halign: 'center' }
      },
      margin: { left: margin, right: margin },
      alternateRowStyles: { fillColor: rowHighlight }
    })
  }

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
  const summaryLabels = isSalesInvoice
    ? ['Total Amount:', 'Discount:', 'GRAND TOTAL:']
    : ['Total Amount:', 'Discount:', 'GRAND TOTAL:', 'Amount Received:']
  const summaryValues = isSalesInvoice
    ? [
        formatCurrency(totalAmount),
        formatCurrency(discountAmount),
        formatCurrency(grandTotal),
      ]
    : [
        `Rs. ${Number(totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        formatCurrency(discountAmount),
        formatCurrency(grandTotal),
        formatCurrency(amountReceived),
      ]

  summaryLabels.forEach((label, idx) => {
    const rowY = currentY + (idx * 5)
    const isGrandTotal = idx === 2
    const isAmountReceived = !isSalesInvoice && idx === 3
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
