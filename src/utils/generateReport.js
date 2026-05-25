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

    // Prepare table data
    const tableData = invoices.map(inv => [
      inv.billNo || 'N/A',
      inv.customerName || 'N/A',
      inv.customerPhone || 'N/A',
      inv.technicianName || 'N/A',
      inv.serviceType || 'N/A',
      `Rs. ${(inv.billAmount || 0).toLocaleString('en-IN')}`,
      `Rs. ${(inv.amountReceived || 0).toLocaleString('en-IN')}`,
      inv.paymentStatus || 'N/A',
      inv.invoiceDate || 'N/A'
    ])

    autoTable(doc, {
      startY: yPos,
      head: [['Invoice #', 'Customer', 'Phone', 'Technician', 'Service', 'Total', 'Received', 'Status', 'Date']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [6, 182, 212], // Cyan
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 7,
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 25, fontSize: 6 }, // Invoice #
        1: { cellWidth: 22 }, // Customer
        2: { cellWidth: 20 }, // Phone
        3: { cellWidth: 20 }, // Technician
        4: { cellWidth: 20 }, // Service
        5: { cellWidth: 18, halign: 'right' }, // Total
        6: { cellWidth: 18, halign: 'right' }, // Received
        7: { cellWidth: 15, halign: 'center' }, // Status
        8: { cellWidth: 18, halign: 'center' } // Date
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
