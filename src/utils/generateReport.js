import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

export const generateReport = (data) => {
  const {
    dateRange,
    totalJobs,
    completedJobs,
    pendingJobs,
    assignedJobs,
    inProgressJobs,
    completionRate,
    totalBilled,
    totalReceived,
    totalPending,
    collectionRate,
    newFitting,
    serviceRepair,
    invoices,
  } = data

  const doc = new jsPDF()
  let yPos = 20

  // Company Header
  doc.setFillColor(6, 182, 212) // Cyan color
  doc.rect(0, 0, 210, 45, 'F')
  
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(28)
  doc.setFont(undefined, 'bold')
  doc.text('FAC', 20, 22)
  
  doc.setFontSize(11)
  doc.setFont(undefined, 'normal')
  doc.text('Friends Aqua Care', 20, 30)
  doc.text('Service Jobs Report', 20, 37)

  // Date Range
  doc.setFontSize(11)
  doc.setFont(undefined, 'bold')
  doc.text(dateRange, 210 - 20, 22, { align: 'right' })
  
  doc.setFontSize(9)
  doc.setFont(undefined, 'normal')
  const generatedDate = new Date().toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
  doc.text(`Generated: ${generatedDate}`, 210 - 20, 30, { align: 'right' })

  yPos = 55

  // ============ SERVICE JOBS SECTION ============
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.text('SERVICE JOBS OVERVIEW', 105, yPos, { align: 'center' })
  yPos += 8

  // Jobs Table
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Total Jobs', String(totalJobs)],
      ['Completed', String(completedJobs)],
      ['Pending', String(pendingJobs)],
      ['In Progress', String(inProgressJobs)],
      ['Completion Rate', `${completionRate}%`]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [6, 182, 212],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 85, fontStyle: 'bold', textColor: [60, 60, 60], halign: 'left' },
      1: { cellWidth: 85, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] }
    },
    margin: { left: 20, right: 20 },
    alternateRowStyles: {
      fillColor: [245, 247, 250]
    },
    didParseCell: function(data) {
      // Align header for second column to right
      if (data.section === 'head' && data.column.index === 1) {
        data.cell.styles.halign = 'right'
      }
    }
  })

  yPos = doc.lastAutoTable.finalY + 10

  // ============ REVENUE SECTION ============
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('REVENUE OVERVIEW', 105, yPos, { align: 'center' })
  yPos += 8

  // Revenue Table
  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Amount']],
    body: [
      ['Total Billed', `Rs. ${totalBilled.toLocaleString('en-IN')}`],
      ['Collected', `Rs. ${totalReceived.toLocaleString('en-IN')}`],
      ['Pending', `Rs. ${totalPending.toLocaleString('en-IN')}`],
      ['Collection Rate', `${collectionRate}%`]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [16, 185, 129],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 85, fontStyle: 'bold', textColor: [60, 60, 60], halign: 'left' },
      1: { cellWidth: 85, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] }
    },
    margin: { left: 20, right: 20 },
    alternateRowStyles: {
      fillColor: [240, 253, 244]
    },
    didParseCell: function(data) {
      // Align header for second column to right
      if (data.section === 'head' && data.column.index === 1) {
        data.cell.styles.halign = 'right'
      }
    }
  })

  yPos = doc.lastAutoTable.finalY + 10

  // ============ SERVICE TYPE SECTION ============
  doc.setFontSize(14)
  doc.setFont(undefined, 'bold')
  doc.setTextColor(0, 0, 0)
  doc.text('SERVICE TYPE BREAKDOWN', 105, yPos, { align: 'center' })
  yPos += 8

  // Service Type Table
  autoTable(doc, {
    startY: yPos,
    head: [['Service Type', 'Count']],
    body: [
      ['New Fitting', String(newFitting)],
      ['Service/Repair', String(serviceRepair)]
    ],
    theme: 'striped',
    headStyles: {
      fillColor: [139, 92, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 11,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5
    },
    columnStyles: {
      0: { cellWidth: 85, fontStyle: 'bold', textColor: [60, 60, 60], halign: 'left' },
      1: { cellWidth: 85, halign: 'right', fontStyle: 'bold', textColor: [0, 0, 0] }
    },
    margin: { left: 20, right: 20 },
    alternateRowStyles: {
      fillColor: [245, 243, 255]
    },
    didParseCell: function(data) {
      // Align header for second column to right
      if (data.section === 'head' && data.column.index === 1) {
        data.cell.styles.halign = 'right'
      }
    }
  })

  yPos = doc.lastAutoTable.finalY + 10

  // ============ INVOICES SECTION ============
  if (invoices && invoices.length > 0) {
    // Check if we need a new page
    if (yPos > 240) {
      doc.addPage()
      yPos = 20
    }

    doc.setFontSize(14)
    doc.setFont(undefined, 'bold')
    doc.setTextColor(0, 0, 0)
    doc.text(`INVOICE DETAILS (${invoices.length} invoices)`, 105, yPos, { align: 'center' })
    yPos += 8

  const fmtDate = (val) => {
    if (!val) return 'N/A'
    // Already in dd/mm/yyyy string format — return as-is
    if (typeof val === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(val)) return val
    let d
    if (val?.toDate) d = val.toDate()
    else d = new Date(val)
    if (isNaN(d)) return String(val)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

    // Prepare table data
    const tableData = invoices.map(inv => {
      const isSale = inv.type === 'sale'
      const total = isSale ? (inv.grandTotal ?? inv.billAmount ?? 0) : (inv.billAmount || 0)
      const received = isSale ? total : (inv.amountReceived || 0)
      const pending = isSale ? 0 : (inv.paymentPending || 0)
      const dateVal = isSale ? fmtDate(inv.createdAt) : fmtDate(inv.invoiceDate)
      const invoiceNo = (inv.invoiceNumber || inv.billNo || 'N/A')
      return [
        invoiceNo,
        isSale ? (inv.companyName || 'N/A') : (inv.customerName || 'N/A'),
        inv.phone || inv.customerPhone || 'N/A',
        isSale ? 'Direct Sale' : (inv.technicianName || 'N/A'),
        isSale ? 'Sale' : (inv.serviceType || 'N/A'),
        `Rs. ${total.toLocaleString('en-IN')}`,
        `Rs. ${received.toLocaleString('en-IN')}`,
        pending > 0 ? 'Pending' : 'Paid',
        dateVal
      ]
    })

    autoTable(doc, {
      startY: yPos,
      head: [['Invoice #', 'Customer', 'Phone', 'Technician', 'Service', 'Total', 'Received', 'Status', 'Date']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [6, 182, 212],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7,
        halign: 'center',
        valign: 'middle',
        cellPadding: 2,
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 2,
        valign: 'middle',
        overflow: 'linebreak',
      },
      columnStyles: {
        0: { cellWidth: 30, halign: 'left' },
        1: { cellWidth: 22, halign: 'left' },
        2: { cellWidth: 22, halign: 'left' },
        3: { cellWidth: 22, halign: 'left' },
        4: { cellWidth: 18, halign: 'left' },
        5: { cellWidth: 18, halign: 'right' },
        6: { cellWidth: 18, halign: 'right' },
        7: { cellWidth: 14, halign: 'center' },
        8: { cellWidth: 20, halign: 'center' },
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      didParseCell: function(data) {
        // Color code payment status
        if (data.column.index === 7 && data.section === 'body') {
          const status = data.cell.raw
          if (status === 'Paid') {
            data.cell.styles.textColor = [16, 185, 129] // Green
            data.cell.styles.fontStyle = 'bold'
          } else if (status === 'Pending') {
            data.cell.styles.textColor = [239, 68, 68] // Red
            data.cell.styles.fontStyle = 'bold'
          }
        }
      },
      margin: { left: 20, right: 20 }
    })

    yPos = doc.lastAutoTable.finalY + 10
  } else {
    doc.setFontSize(10)
    doc.setTextColor(150, 150, 150)
    doc.text('No invoices found for this period', 20, yPos)
  }

  // Footer on last page
  const pageCount = doc.internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 10,
      { align: 'center' }
    )
    doc.text(
      'Copyright FAC - Friends Aqua Care',
      20,
      doc.internal.pageSize.height - 10
    )
  }

  // Save the PDF
  const formatDateForFilename = (dateStr) => {
    // Convert "20 May 2026" to "20_May_2026"
    return dateStr.replace(/\s+/g, '_')
  }
  
  const fileName = `FAC_Report_${formatDateForFilename(dateRange)}.pdf`
  doc.save(fileName)
}
