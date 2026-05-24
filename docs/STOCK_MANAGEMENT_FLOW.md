# Stock Management System - Complete Flow

## Overview
This system allows admins to assign stock to technicians and technicians to take stock directly from inventory with daily limits.

## Database Collections

### 1. `stock_assignments`
Stores all stock assignments (both admin-assigned and self-taken)

```
{
  id: string (auto-generated)
  technicianId: string (technician's UID)
  technicianName: string
  productId: string
  productName: string
  quantity: number
  assignedBy: 'admin' | 'self'
  assignedAt: timestamp
  status: 'active' | 'used' | 'returned'
}
```

### 2. `direct_stock_takes`
Tracks direct stock takes for daily limit enforcement

```
{
  id: string (auto-generated)
  technicianId: string
  technicianName: string
  productId: string
  productName: string
  quantity: number
  takenAt: timestamp
  status: 'active' | 'used'
}
```

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN DASHBOARD                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  TechnicianStockAssignment Component                        │
│  ├─ View all technicians                                   │
│  ├─ Assign stock to specific technician                    │
│  │  ├─ Select technician                                   │
│  │  ├─ Select product                                      │
│  │  ├─ Enter quantity (NO LIMIT)                           │
│  │  └─ Create stock_assignments record                     │
│  └─ View assigned stock per technician                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                 TECHNICIAN DASHBOARD                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  DirectStockTaking Component                               │
│  ├─ View daily limit (20 items)                            │
│  ├─ View today's taken quantity                            │
│  ├─ View remaining limit                                   │
│  ├─ Take stock directly from inventory                     │
│  │  ├─ Select product                                      │
│  │  ├─ Enter quantity (MAX: remaining limit)               │
│  │  ├─ Create direct_stock_takes record                    │
│  │  └─ Also create stock_assignments record                │
│  └─ View all available stock                               │
│     ├─ Admin-assigned stock                                │
│     └─ Self-taken stock                                    │
│                                                              │
│  MyStock Component                                          │
│  ├─ Display total available stock                          │
│  ├─ Show stock breakdown by product                        │
│  ├─ Indicate source (admin vs self)                        │
│  └─ Use stock when completing jobs                         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### Admin Side
✅ Assign unlimited stock to technicians
✅ View all technician stock assignments
✅ Track which technicians have what stock
✅ No limits on admin assignments

### Technician Side
✅ Take stock directly (20 items/day limit)
✅ View all available stock (admin + self-taken)
✅ Daily limit tracking with visual progress bar
✅ Work with stock immediately without waiting
✅ See source of each stock item

## Daily Limit Logic

```javascript
DAILY_LIMIT = 20 items

// Calculate today's total
todaysTotal = sum of all direct_stock_takes for today

// Calculate remaining
remaining = DAILY_LIMIT - todaysTotal

// Validation
if (quantity > remaining) {
  show error: "You can only take X more items today"
}
```

## Stock Usage Flow

When technician completes a job:
1. Select products from available stock
2. Deduct from stock_assignments
3. Create job_completion record with used products
4. Update stock status to 'used'

## Integration Points

### Components to Add to Admin Dashboard
- Import `TechnicianStockAssignment` in AdminHome.jsx
- Add route/tab for stock management

### Components to Add to Technician Dashboard
- Import `DirectStockTaking` in TechnicianHome.jsx
- Update existing `MyStock` to show unified view
- Add stock usage when completing jobs

## Example Scenarios

### Scenario 1: Admin Assignment
1. Admin assigns 30 units of Product A to Technician John
2. John sees 30 units in his stock
3. John can use all 30 units (no limit on admin assignments)

### Scenario 2: Direct Take
1. John has 0 stock
2. John takes 20 units of Product B (daily limit)
3. John sees 20 units in his stock
4. Next day, John can take 20 more units

### Scenario 3: Mixed Stock
1. Admin assigns 30 units of Product A to John
2. John takes 15 units of Product B (within daily limit)
3. John now has 45 total units (30 + 15)
4. John can use all 45 units for jobs

## Security Considerations

✅ Technicians can only take up to daily limit
✅ Technicians can only see their own stock
✅ Admin can assign unlimited stock
✅ All transactions are logged with timestamps
✅ Stock source is tracked (admin vs self)

## Future Enhancements

- Stock return functionality
- Weekly/monthly limits
- Stock expiry tracking
- Low stock alerts
- Stock audit reports
- Technician performance metrics based on stock usage
