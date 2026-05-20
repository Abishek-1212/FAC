# Invoice Generation - Example Usage

## Example 1: Basic Invoice Generation

```javascript
import { generateInvoice } from '../utils/generateInvoice'

const invoiceData = {
  invoiceNumber: "FAC-1234567890",
  customerName: "Arun Kumar",
  customerPhone: "9876543210",
  customerAddress: "Udumalpet, Tamil Nadu",
  technicianName: "Ravi",
  serviceDate: "20-05-2024",
  serviceType: "Service / Repair",
  problemDescription: "Filter replacement and membrane cleaning",
  serviceCharge: 300,
  products: [
    { name: "RO Filter", qty: 1, price: 600 },
    { name: "Membrane", qty: 1, price: 1200 },
    { name: "Service Labor", qty: 1, price: 300 }
  ],
  notes: "Service completed successfully. Customer satisfied."
}

// Generate and download PDF
generateInvoice(invoiceData)
// Downloads: FAC-Invoice-Arun-Kumar-FAC-1234567890.pdf
```

## Example 2: Admin Invoice Generation Flow

```javascript
// In Invoices.jsx component

const handleGenerateInvoice = async () => {
  // 1. Get selected job
  const job = selectedJob // { customerName, customerPhone, ... }
  
  // 2. Get products from form
  const products = [
    { name: "Filter", qty: 1, price: 600 },
    { name: "Membrane", qty: 1, price: 1200 }
  ]
  
  // 3. Get service charge
  const serviceCharge = 300
  
  // 4. Get notes
  const notes = "Service completed successfully"
  
  // 5. Create invoice data
  const invoiceNumber = `FAC-${Date.now()}`
  const invoiceData = {
    invoiceNumber,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    customerAddress: job.customerAddress,
    technicianName: job.technicianName,
    serviceType: job.serviceType,
    problemDescription: job.problemDescription,
    serviceCharge,
    products,
    notes
  }
  
  // 6. Save to Firestore
  await addDoc(collection(db, 'invoices'), {
    ...invoiceData,
    totalAmount: products.reduce((sum, p) => sum + (p.qty * p.price), 0) + serviceCharge,
    createdAt: serverTimestamp()
  })
  
  // 7. Generate PDF
  generateInvoice(invoiceData)
  
  // 8. Show success message
  toast.success('✅ Invoice generated and saved!')
}
```

## Example 3: Firestore Query - Get All Invoices

```javascript
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// Get all invoices
const getAllInvoices = async () => {
  const q = query(collection(db, 'invoices'))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Get invoices for a specific customer
const getCustomerInvoices = async (customerName) => {
  const q = query(
    collection(db, 'invoices'),
    where('customerName', '==', customerName)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}

// Get invoices from a date range
const getInvoicesByDateRange = async (startDate, endDate) => {
  const q = query(
    collection(db, 'invoices'),
    where('createdAt', '>=', startDate),
    where('createdAt', '<=', endDate)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
}
```

## Example 4: Calculate Invoice Totals

```javascript
// Calculate products total
const calculateProductsTotal = (products) => {
  return products.reduce((sum, product) => {
    return sum + (product.qty * product.price)
  }, 0)
}

// Calculate final amount
const calculateFinalAmount = (products, serviceCharge) => {
  const productsTotal = calculateProductsTotal(products)
  return productsTotal + serviceCharge
}

// Usage
const products = [
  { name: "Filter", qty: 1, price: 600 },
  { name: "Membrane", qty: 1, price: 1200 }
]
const serviceCharge = 300

const productsTotal = calculateProductsTotal(products) // 1800
const finalAmount = calculateFinalAmount(products, serviceCharge) // 2100
```

## Example 5: Format Invoice Data for Display

```javascript
// Format currency
const formatCurrency = (amount) => {
  return `₹${amount.toFixed(2)}`
}

// Format date
const formatDate = (timestamp) => {
  if (!timestamp) return '—'
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000)
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

// Usage
const invoice = {
  totalAmount: 2100,
  createdAt: { seconds: 1234567890 }
}

console.log(formatCurrency(invoice.totalAmount)) // ₹2100.00
console.log(formatDate(invoice.createdAt)) // 20/05/2024
```

## Example 6: Technician Filtering

```javascript
// Filter jobs by period
const filterByPeriod = (jobs, period) => {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch(period) {
    case 'today':
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return jobs.filter(j => {
        const jobDate = new Date(j.createdAt.seconds * 1000)
        return jobDate >= today && jobDate < tomorrow
      })
    
    case 'week':
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 7)
      return jobs.filter(j => {
        const jobDate = new Date(j.createdAt.seconds * 1000)
        return jobDate >= weekStart && jobDate < weekEnd
      })
    
    case 'month':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      return jobs.filter(j => {
        const jobDate = new Date(j.createdAt.seconds * 1000)
        return jobDate >= monthStart && jobDate < monthEnd
      })
    
    default:
      return jobs
  }
}

// Filter jobs by status
const filterByStatus = (jobs, status) => {
  switch(status) {
    case 'active':
      return jobs.filter(j => ['assigned', 'in_progress'].includes(j.status))
    case 'completed':
      return jobs.filter(j => j.status === 'completed')
    case 'missed':
      return jobs.filter(j => ['pending', 'assigned'].includes(j.status))
    default:
      return jobs
  }
}

// Usage
const jobs = [/* ... */]
const activeToday = filterByStatus(filterByPeriod(jobs, 'today'), 'active')
const completedThisWeek = filterByStatus(filterByPeriod(jobs, 'week'), 'completed')
```

## Example 7: Invoice Statistics

```javascript
// Get invoice statistics
const getInvoiceStats = (invoices) => {
  return {
    totalInvoices: invoices.length,
    totalRevenue: invoices.reduce((sum, inv) => sum + inv.totalAmount, 0),
    averageInvoiceAmount: invoices.length > 0 
      ? invoices.reduce((sum, inv) => sum + inv.totalAmount, 0) / invoices.length 
      : 0,
    invoicesByMonth: invoices.reduce((acc, inv) => {
      const month = new Date(inv.createdAt.seconds * 1000).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
      acc[month] = (acc[month] || 0) + 1
      return acc
    }, {}),
    topCustomers: invoices.reduce((acc, inv) => {
      const existing = acc.find(c => c.name === inv.customerName)
      if (existing) {
        existing.count++
        existing.totalSpent += inv.totalAmount
      } else {
        acc.push({ name: inv.customerName, count: 1, totalSpent: inv.totalAmount })
      }
      return acc
    }, []).sort((a, b) => b.totalSpent - a.totalSpent)
  }
}

// Usage
const stats = getInvoiceStats(invoices)
console.log(`Total Revenue: ₹${stats.totalRevenue}`)
console.log(`Average Invoice: ₹${stats.averageInvoiceAmount}`)
console.log(`Top Customer: ${stats.topCustomers[0]?.name}`)
```

## Example 8: Export Invoices to CSV

```javascript
// Export invoices to CSV
const exportInvoicesToCSV = (invoices) => {
  const headers = ['Invoice #', 'Customer', 'Phone', 'Amount', 'Date']
  const rows = invoices.map(inv => [
    inv.invoiceNumber,
    inv.customerName,
    inv.customerPhone,
    inv.totalAmount,
    new Date(inv.createdAt.seconds * 1000).toLocaleDateString('en-IN')
  ])
  
  const csv = [
    headers.join(','),
    ...rows.map(row => row.join(','))
  ].join('\n')
  
  // Download CSV
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `invoices-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// Usage
exportInvoicesToCSV(invoices)
```

## Common Patterns

### Pattern 1: Generate Invoice on Job Completion
```javascript
// When technician marks job as completed
const handleJobCompletion = async (jobId) => {
  // Update job status
  await updateDoc(doc(db, 'service_jobs', jobId), {
    status: 'completed'
  })
  
  // Show invoice generation prompt
  showInvoiceModal(jobId)
}
```

### Pattern 2: Auto-Generate Invoice
```javascript
// Automatically generate invoice when job is completed
const autoGenerateInvoice = async (job) => {
  const invoiceNumber = `FAC-${Date.now()}`
  const invoiceData = {
    invoiceNumber,
    customerName: job.customerName,
    customerPhone: job.customerPhone,
    customerAddress: job.customerAddress,
    technicianName: job.technicianName,
    serviceType: job.serviceType,
    problemDescription: job.problemDescription,
    serviceCharge: 0,
    products: [],
    notes: 'Auto-generated invoice'
  }
  
  await addDoc(collection(db, 'invoices'), {
    ...invoiceData,
    totalAmount: 0,
    createdAt: serverTimestamp()
  })
}
```

### Pattern 3: Invoice Reminder
```javascript
// Send reminder for unpaid invoices
const sendUnpaidInvoiceReminder = async (invoiceId) => {
  const invoice = await getDoc(doc(db, 'invoices', invoiceId))
  
  if (invoice.data().status !== 'paid') {
    // Send notification/email
    console.log(`Reminder: Invoice ${invoice.data().invoiceNumber} is unpaid`)
  }
}
```

---

These examples cover the most common use cases for the invoice generation system. Adapt them to your specific needs!
