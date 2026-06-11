export const logDownloadFlow = (invoiceSaved, savedInvoiceData, products, personalStockUsage, totalAmount, discountValue, discountAmount, grandTotal, amountReceived, discountType, paymentType, job) => {
  console.log('\n' + '='.repeat(60))
  console.log('DOWNLOAD BUTTON CLICKED - DEBUG LOGS')
  console.log('='.repeat(60))
  
  console.log('\n[STATUS CHECK]')
  console.log('  invoiceSaved:', invoiceSaved)
  console.log('  savedInvoiceData exists:', !!savedInvoiceData)
  
  if (invoiceSaved && savedInvoiceData) {
    console.log('\n[PATH] Using SAVED invoice data from Firestore')
    console.log('\n[SAVED DATA - Basic Info]')
    console.log('  billNo:', savedInvoiceData.billNo)
    console.log('  customerName:', savedInvoiceData.customerName)
    console.log('  technicianName:', savedInvoiceData.technicianName)
    console.log('  invoiceDate:', savedInvoiceData.invoiceDate)
    
    console.log('\n[SAVED DATA - Amounts]')
    console.log('  totalAmount:', savedInvoiceData.totalAmount)
    console.log('  discountType:', savedInvoiceData.discountType)
    console.log('  discountValue:', savedInvoiceData.discountValue)
    console.log('  discountAmount:', savedInvoiceData.discountAmount)
    console.log('  billAmount (grandTotal):', savedInvoiceData.billAmount)
    console.log('  amountReceived:', savedInvoiceData.amountReceived)
    console.log('  modeOfPayment:', savedInvoiceData.modeOfPayment)
    
    console.log('\n[SAVED DATA - Products]')
    console.log('  products count:', savedInvoiceData.products?.length || 0)
    if (savedInvoiceData.products && savedInvoiceData.products.length > 0) {
      savedInvoiceData.products.forEach((p, idx) => {
        console.log(`  [${idx}] name: ${p.name}, qty: ${p.qty} (type: ${typeof p.qty}), price: ${p.price} (type: ${typeof p.price})`)
      })
    } else {
      console.error('  ⚠️ NO PRODUCTS FOUND IN SAVED DATA!')
    }
  } else {
    console.log('\n[PATH] Reconstructing from form state (invoice not saved yet)')
    
    console.log('\n[FORM STATE - Products from completion report]')
    console.log('  count:', products.length)
    products.forEach((p, idx) => {
      console.log(`  [${idx}] name: ${p.name}, qty: ${p.qty} (type: ${typeof p.qty}), price: ${p.price}`)
    })
    
    console.log('\n[FORM STATE - Personal stock usage]')
    console.log('  count:', personalStockUsage.length)
    personalStockUsage.forEach((item, idx) => {
      if (item.productId && Number(item.used) > 0) {
        console.log(`  [${idx}] name: ${item.productName}, used: ${item.used} (type: ${typeof item.used}), price: ${item.price}`)
      }
    })
    
    console.log('\n[FORM STATE - Amounts]')
    console.log('  totalAmount:', totalAmount)
    console.log('  discountType:', discountType)
    console.log('  discountValue:', discountValue)
    console.log('  discountAmount:', discountAmount)
    console.log('  grandTotal:', grandTotal)
    console.log('  amountReceived:', amountReceived)
    console.log('  paymentType:', paymentType)
  }
  
  console.log('\n' + '='.repeat(60))
  console.log('Check browser console for full details')
  console.log('='.repeat(60) + '\n')
}
