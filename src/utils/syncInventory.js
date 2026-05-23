import { collection, getDocs, query, where, updateDoc, doc } from 'firebase/firestore'
import { db } from '../firebase'

/**
 * One-time sync utility to update inventory collection with latest product data
 * Run this once to fix existing mismatches between products and inventory
 */
export async function syncInventoryWithProducts() {
  try {
    console.log('🔄 Starting inventory sync...')
    
    // Get all products
    const productsSnap = await getDocs(collection(db, 'products'))
    const products = productsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    
    // Get all inventory items
    const inventorySnap = await getDocs(collection(db, 'inventory'))
    const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() }))
    
    let updatedCount = 0
    
    for (const product of products) {
      // Find matching inventory item by product name
      const invItem = inventory.find(inv => 
        inv.productName === product.name || inv.name === product.name
      )
      
      if (invItem) {
        // Check if update is needed
        const needsUpdate = 
          invItem.price !== product.price ||
          invItem.productName !== product.name ||
          invItem.name !== product.name ||
          invItem.category !== product.category
        
        if (needsUpdate) {
          await updateDoc(doc(db, 'inventory', invItem.id), {
            productName: product.name,
            name: product.name,
            price: product.price,
            category: product.category,
          })
          console.log(`✅ Updated: ${product.name} (Price: ₹${product.price})`)
          updatedCount++
        }
      }
    }
    
    console.log(`✅ Sync complete! Updated ${updatedCount} items.`)
    return { success: true, updatedCount }
  } catch (error) {
    console.error('❌ Sync failed:', error)
    return { success: false, error: error.message }
  }
}
