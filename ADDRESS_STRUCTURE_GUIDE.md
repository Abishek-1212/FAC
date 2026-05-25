# Address Structure Implementation Guide

## Overview
The address system has been refactored to use a structured object format instead of a single string. This allows for better organization, validation, and display of address information.

## New Address Structure

The address is now stored as a structured object with the following fields in order:

```javascript
{
  houseNo: '',      // House No (e.g., "12/4")
  building: '',     // Building Name (e.g., "ABC Apartments") - REQUIRED
  street: '',       // Street Name (e.g., "Gandhi Street") - REQUIRED
  area: '',         // Area / Locality (e.g., "Anna Nagar") - REQUIRED
  landmark: '',     // Landmark (e.g., "Near Bus Stand")
  city: '',         // City (e.g., "Chennai") - REQUIRED
  pinNo: '',        // Pin No (e.g., "620019") - REQUIRED
  state: '',        // State (e.g., "Tamil Nadu") - REQUIRED
  pinCode: ''       // PIN Code (e.g., "620019") - REQUIRED
}
```

## New Components & Utilities

### 1. AddressInput Component
**Location:** `src/components/common/AddressInput.jsx`

A reusable form component for entering structured address data with 9 fields.

**Usage:**
```jsx
import AddressInput from '../common/AddressInput'

<AddressInput
  value={form.customerAddress}
  onChange={addr => setForm(f => ({ ...f, customerAddress: addr }))}
  disabled={false}
/>
```

**Required Fields:**
- Building Name
- Street Name
- Area / Locality
- City
- Pin No
- State
- PIN Code

**Optional Fields:**
- House No
- Landmark

### 2. Address Formatter Utility
**Location:** `src/utils/addressFormatter.js`

Contains two formatting functions:

#### `formatAddressForDisplay(addressObj)`
Formats address for multi-line display (used in job details):
```
12/4,
ABC Apartments,
Gandhi Street,
Anna Nagar,
Near Bus Stand,
Chennai,
620019,
Tamil Nadu - 620019
```

#### `formatAddressCompact(addressObj)`
Formats address for compact single-line display:
```
12/4, ABC Apartments, Gandhi Street, Anna Nagar, Chennai, 620019
```

**Usage:**
```jsx
import { formatAddressForDisplay, formatAddressCompact } from '../../utils/addressFormatter'

// For multi-line display
<p className="whitespace-pre-line">{formatAddressForDisplay(job.customerAddress)}</p>

// For compact display
<p>{formatAddressCompact(job.customerAddress)}</p>
```

## Updated Components

### Admin Portal
1. **ServiceJobs.jsx** - Updated to use AddressInput component and formatAddressForDisplay
2. **RecentServiceJobs.jsx** - Updated to display formatted address in job details popup

### Technician Portal
1. **JobDetail.jsx** - Updated to display formatted address with whitespace-pre-line class

## Database Storage Format

When creating new jobs, the address will be stored as a structured object:
```javascript
{
  customerName: "John Doe",
  customerPhone: "9025840034",
  customerAddress: {
    houseNo: "12/4",
    building: "ABC Apartments",
    street: "Gandhi Street",
    area: "Anna Nagar",
    landmark: "Near Bus Stand",
    city: "Chennai",
    pinNo: "620019",
    state: "Tamil Nadu",
    pinCode: "620019"
  },
  // ... other fields
}
```

## Backward Compatibility

The formatter functions handle both:
- New structured address objects
- Legacy string addresses (for existing jobs)

If a string is passed to the formatter, it will return the string as-is.

## Display Format Example

**Before:**
```
📍 Address: 331, abishekbalanivas, vijayalakshminagar, athipalayam, coimbatore
```

**After:**
```
📍 Address:
12/4,
ABC Apartments,
Gandhi Street,
Anna Nagar,
Near Bus Stand,
Chennai,
620019,
Tamil Nadu - 620019
```

## Form Validation

The AddressInput component enforces:
- **Required fields:** building, street, area, city, pinNo, state, pinCode
- **Optional fields:** houseNo, landmark

## CSS Classes Used

- `whitespace-pre-line` - Preserves line breaks in address display
- `col-span-2` - Makes address field span full width in grid layout

## Testing Checklist

- [ ] Create new job with structured address
- [ ] Verify all 9 address fields are displayed in form
- [ ] Verify address displays correctly in admin job details (multi-line)
- [ ] Verify address displays correctly in technician job details (multi-line)
- [ ] Verify address displays correctly in recent jobs popup
- [ ] Test with both light and dark themes
- [ ] Verify form validation for required fields
- [ ] Test address editing functionality
- [ ] Verify backward compatibility with legacy string addresses
