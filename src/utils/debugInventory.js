import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * Debug utility to check inventory and stock data
 */
export async function debugInventoryIssue(productName) {
  try {
    console.log('🔍 Debugging inventory for:', productName)
    
    // Check inventory collection
    const invRef = collection(db, 'inventory')
    const invQuery = query(invRef, where('productName', '==', productName))
    const invSnap = await getDocs(invQuery)
    
    console.log('📦 Inventory records found:', invSnap.size)
    invSnap.forEach(doc => {
      console.log('  - Doc ID:', doc.id)
      console.log('  - Data:', doc.data())
    })
    
    // Check alternative name field
    const invQuery2 = query(invRef, where('name', '==', productName))
    const invSnap2 = await getDocs(invQuery2)
    
    console.log('📦 Inventory records (name field):', invSnap2.size)
    invSnap2.forEach(doc => {
      console.log('  - Doc ID:', doc.id)
      console.log('  - Data:', doc.data())
    })
    
    // Check technician stock
    const techStockRef = collection(db, 'technician_stock')
    const techQuery = query(techStockRef, where('productName', '==', productName))
    const techSnap = await getDocs(techQuery)
    
    console.log('👷 Technician stock records:', techSnap.size)
    techSnap.forEach(doc => {
      const data = doc.data()
      console.log('  - Doc ID:', doc.id)
      console.log('  - Product Name:', data.productName)
      console.log('  - Taken:', data.takenQuantity)
      console.log('  - Used:', data.usedQuantity)
      console.log('  - Returned:', data.returnedQuantity)
      console.log('  - Status:', data.status)
    })
    
    // Check stock transactions
    const transRef = collection(db, 'stock_transactions')
    const transQuery = query(transRef, where('productName', '==', productName))
    const transSnap = await getDocs(transQuery)
    
    console.log('📝 Stock transactions:', transSnap.size)
    transSnap.forEach(doc => {
      const data = doc.data()
      console.log('  - Type:', data.type)
      console.log('  - Quantity:', data.quantity)
      console.log('  - Timestamp:', data.timestamp?.toDate())
    })
    
    return {
      inventoryRecords: invSnap.size,
      technicianStockRecords: techSnap.size,
      transactions: transSnap.size
    }
  } catch (error) {
    console.error('❌ Debug failed:', error)
    return { error: error.message }
  }
}
