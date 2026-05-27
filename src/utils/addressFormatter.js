export function formatAddressForDisplay(addressObj) {
  if (!addressObj) return '—'
  
  if (typeof addressObj === 'string') {
    return addressObj
  }

  const parts = []
  
  if (addressObj.houseNo) parts.push(addressObj.houseNo)
  if (addressObj.building) parts.push(addressObj.building)
  if (addressObj.street) parts.push(addressObj.street)
  if (addressObj.city) parts.push(addressObj.city)
  if (addressObj.state) parts.push(addressObj.state)
  
  if (addressObj.pinCode) {
    const lastPart = parts[parts.length - 1]
    parts[parts.length - 1] = `${lastPart} - ${addressObj.pinCode}`
  }

  if (addressObj.landmark) parts.push(addressObj.landmark)

  return parts.join(',\n')
}

export function formatAddressCompact(addressObj) {
  if (!addressObj) return '—'
  
  if (typeof addressObj === 'string') {
    return addressObj
  }

  const parts = []
  
  if (addressObj.houseNo) parts.push(addressObj.houseNo)
  if (addressObj.building) parts.push(addressObj.building)
  if (addressObj.street) parts.push(addressObj.street)
  if (addressObj.city) parts.push(addressObj.city)
  if (addressObj.state) parts.push(addressObj.state)
  if (addressObj.pinCode) parts.push(addressObj.pinCode)
  if (addressObj.landmark) parts.push(addressObj.landmark)

  return parts.join(', ')
}
