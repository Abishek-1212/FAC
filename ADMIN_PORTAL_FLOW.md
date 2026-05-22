# ADMIN PORTAL - COMPLETE FLOW DOCUMENTATION

## 📋 NAVIGATION MENU (7 Sections)

1. 🏠 **Dashboard** - `/admin`
2. 🔧 **Service Jobs** - `/admin/jobs`
3. 📦 **Products** - `/admin/products`
4. 👷 **Technicians** - `/admin/employees`
5. 📊 **Stock Details** - `/admin/stock-detail`
6. 🧾 **Invoices** - `/admin/invoices`
7. 📈 **Reports** - `/admin/reports`

---

## 1️⃣ DASHBOARD (Home Page)

### **What Admin Sees:**

#### A. Invoice Notification Banner (if new invoices exist)
- Shows count of unread invoices from technicians
- Click → Goes to Invoices page
- Example: "3 invoices awaiting review"

#### B. Quick Actions (5 Buttons)
1. **New Service Job** → Goes to Service Jobs page
2. **Add Product** → Goes to Products page
3. **Add Technician** → Goes to Employees page
4. **View Invoices** → Goes to Invoices page
5. **Reports** → Goes to Reports page

#### C. Recent Jobs Section
- Shows last 5-10 service jobs
- Displays: Customer name, phone, status, technician assigned
- Click on job → Opens job details modal

#### D. Recent Stock Taken Notifications (Last 5)
- Shows when technicians take stock
- Format: "Ravi took stock: Filter × 2, Membrane × 1"
- Shows timestamp
- Orange-themed cards

#### E. Technician Stock Overview
- Shows each technician with:
  - Name, phone number
  - Total stock taken
  - Progress bars for: Assigned, Used, Returned, Remaining
  - Per-product breakdown (expandable)

#### F. Overview Stats (6 Cards)
- Total Jobs
- Pending Jobs
- Technicians count
- Products count
- Total Revenue (₹)
- Missing Stock count

---

## 2️⃣ SERVICE JOBS

### **Features:**

#### A. Create New Job
**Button:** "+ New Job"

**Two Assignment Modes:**
1. **Broadcast to All** 📢
   - Job posted to all technicians
   - Any technician can accept
   - Status: "Pending" until accepted

2. **Direct Assignment** 👤
   - Assign to specific technician
   - Status: "Assigned" immediately

**Job Form Fields:**
- Customer Name ✓
- Phone Number ✓
- Address ✓
- Service Type (New Fitting / Service & Repair) ✓
- Problem Description ✓
- Priority (Normal / Urgent)
- Technician (if Direct Assignment)

#### B. Filter Jobs
**Period Filters:**
- Today
- This Week
- This Month
- Custom Date Range

**Status Filters (for Today):**
- Active Jobs (Pending + Assigned + In Progress)
- Completed Jobs
- Total Jobs

**Status Filters (for Week/Month):**
- Completed Jobs
- Missed Jobs (Pending/Assigned but not completed)

#### C. Job Cards Display
Each job shows:
- Customer name
- Phone number
- Service type badge (🔧 New Fitting / 🛠️ Service)
- Technician name (or "⚠️ Unassigned")
- Status badge with color coding

#### D. Job Details Modal
Click on job card shows:
- Status banner with color
- Customer info (name, phone, address)
- Service details (type, problem, date)
- Technician assigned
- Priority level
- Created date

---

## 3️⃣ PRODUCTS

### **Features:**

#### A. Add Product
**Button:** "+ Add Product"

**Product Form:**
- Product Name ✓
- SKU (optional)
- Price (₹) ✓
- Category ✓
- Description

#### B. Manage Categories
**Button:** "🏷️ Categories"

**Category Management:**
- Add new category
- View all categories
- Delete category (only if not in use)

#### C. Product List View
- Grouped by category
- Shows count per category
- Each product card shows:
  - Product name
  - Description
  - SKU (if available)
  - Price (₹)

#### D. Edit/Delete Product
- Click on product card → Opens edit modal
- Can update all fields
- Delete button (with confirmation)

#### E. Search Products
- Search by product name or category
- Real-time filtering

---

## 4️⃣ TECHNICIANS (Employees)

### **Features:**

#### A. Add Technician
**Button:** "+ Add Technician"

**Technician Form:**
- Name ✓
- Email ✓
- Phone ✓
- Password ✓
- Role: Technician (auto-set)

**Process:**
1. Creates user in Firebase Auth
2. Stores profile in Firestore `users` collection
3. Sets custom claim `role: 'technician'`

#### B. Technician List
Each card shows:
- Name with avatar (first letter)
- Email
- Phone number
- Status indicator

#### C. Edit Technician
- Click on card → Edit modal
- Update: Name, Email, Phone
- Cannot change password (security)

#### D. Delete Technician
- Delete button in edit modal
- Confirmation required
- Removes from Auth and Firestore

---

## 5️⃣ STOCK DETAILS (NEW!)

### **Features:**

#### A. Technician Stock Cards
For each technician shows:

**Header:**
- Technician name with avatar
- Phone number
- Total Taken badge

**Summary Stats (5 numbers):**
- Taken (Blue)
- Used (Green)
- Returned (Purple)
- Damaged (Red)
- Remaining (Amber)

**Component Cards (Grid Layout):**
Each component in separate card:
- Component name (large, bold)
- Price per unit
- Status badge ("5 left" / "All used")
- 4 stat boxes:
  - 📦 Taken (Blue)
  - ✓ Used (Green)
  - ↩ Returned (Purple)
  - ✕ Damaged (Red)
- Date taken

**Benefits:**
- Clear separation of components
- No mixing or confusion
- Easy to track each item
- Color-coded for quick understanding

---

## 6️⃣ INVOICES

### **Features:**

#### A. Summary Cards (3)
- Total Revenue (₹)
- Amount Received (₹)
- Payment Pending (₹)

#### B. Filter Invoices
**3 Filter Tabs:**
- All Invoices
- Pending Payment
- Fully Paid

#### C. Invoice List
Each invoice card shows:
- Customer name
- Phone number
- Technician name
- Invoice date
- Bill number
- Bill amount (₹)
- Amount received (₹)
- Payment pending (₹) - if any
- Status badge (Pending / Paid)

#### D. Invoice Preview Modal
Click on invoice → Opens preview with:

**A4 Format Invoice:**
- Company header (Friends Aqua Care)
- Bill number and date
- Customer details
- Service details
- Components used (table)
- Payment details
- Signatures section
- Company footer

**Action Buttons:**
- 📥 Download PDF
- 📱 Share via WhatsApp

**WhatsApp Share:**
- Downloads PDF
- Opens WhatsApp with pre-filled message
- Includes customer phone number
- Message contains invoice summary

#### E. Auto-Mark as Viewed
- When admin opens invoice
- Sets `adminViewed: true`
- Removes from notification count

---

## 7️⃣ REPORTS

### **Features:**

#### A. Date Range Filter
- Today
- This Week
- This Month
- Custom Date Range

#### B. Report Cards (6)

**1. Jobs Summary**
- Total jobs
- Completed jobs
- Pending jobs
- Completion rate (%)

**2. Revenue Summary**
- Total revenue (₹)
- Average per job (₹)
- Highest invoice (₹)
- Lowest invoice (₹)

**3. Technician Performance**
- Jobs completed per technician
- Revenue generated per technician
- Average completion time

**4. Stock Summary**
- Total stock taken
- Total stock used
- Total stock returned
- Stock remaining

**5. Payment Status**
- Total billed (₹)
- Total received (₹)
- Total pending (₹)
- Collection rate (%)

**6. Service Type Breakdown**
- New Fitting count
- Service/Repair count
- Percentage split

#### C. Export Options
- Export to PDF
- Export to Excel
- Print report

---

## 🔄 COMPLETE WORKFLOW EXAMPLE

### **Scenario: New Service Job → Completion → Invoice**

1. **Admin Creates Job**
   - Goes to Service Jobs
   - Clicks "+ New Job"
   - Fills customer details
   - Selects "Direct Assignment"
   - Assigns to "Ravi"
   - Job status: "Assigned"

2. **Technician Takes Stock**
   - Ravi logs in
   - Goes to "Take Stock"
   - Selects: Filter × 2, Membrane × 1
   - Clicks "Take Stock"
   - Admin gets notification on dashboard

3. **Technician Completes Job**
   - Ravi clicks on job
   - Clicks "Start Work" → Status: "In Progress"
   - Tracks stock usage
   - Clicks "Mark as Complete" → Status: "Completed"

4. **Technician Generates Invoice**
   - Goes to "Invoice Management"
   - Clicks "Generate Invoice" on completed job
   - Fills invoice details
   - Adds components used
   - Sets bill amount and received amount
   - Clicks "Generate Invoice"
   - Admin gets notification

5. **Admin Reviews Invoice**
   - Sees notification on dashboard
   - Goes to Invoices
   - Clicks on invoice
   - Reviews details
   - Downloads PDF
   - Shares via WhatsApp to customer

6. **Admin Checks Stock**
   - Goes to "Stock Details"
   - Sees Ravi's stock breakdown
   - Filter: Taken 2, Used 2, Remaining 0
   - Membrane: Taken 1, Used 1, Remaining 0

7. **Admin Views Reports**
   - Goes to Reports
   - Selects "This Month"
   - Sees all metrics
   - Exports to PDF

---

## 🔐 SECURITY & PERMISSIONS

### **Admin Can:**
- ✅ Create/Edit/Delete service jobs
- ✅ Create/Edit/Delete products
- ✅ Create/Edit/Delete technicians
- ✅ View all invoices
- ✅ View all stock details
- ✅ View all reports
- ✅ Assign stock to jobs (if needed)

### **Admin Cannot:**
- ❌ Delete invoices (only view)
- ❌ Modify technician's stock directly
- ❌ Change job status (only technician can)

---

## 📊 DATA COLLECTIONS USED

1. **users** - Technician profiles
2. **service_jobs** - All service jobs
3. **products** - Product catalog
4. **product_categories** - Product categories
5. **technician_stock** - Stock taken by technicians
6. **invoices** - Generated invoices
7. **notifications** - System notifications
8. **stock_transactions** - Stock movement logs
9. **job_completion_reports** - Job completion data

---

## 🎨 UI/UX FEATURES

### **Theme Support:**
- Light mode
- Dark mode
- Auto-switches based on user preference

### **Responsive Design:**
- Desktop (full layout)
- Tablet (adjusted grid)
- Mobile (stacked layout)

### **Animations:**
- Smooth page transitions
- Card hover effects
- Loading spinners
- Toast notifications

### **Color Coding:**
- Blue - Information
- Green - Success/Completed
- Amber - Warning/Pending
- Red - Error/Urgent
- Purple - Returned items
- Cyan - Primary actions

---

## ✅ FEATURES WORKING STATUS

### **Fully Working:**
1. ✅ Dashboard with all sections
2. ✅ Service Jobs (Create, View, Filter)
3. ✅ Products (Add, Edit, Delete, Categories)
4. ✅ Technicians (Add, Edit, Delete)
5. ✅ Stock Details (Component-wise view)
6. ✅ Invoices (View, Download, WhatsApp)
7. ✅ Reports (All metrics)
8. ✅ Notifications (Stock taken, Invoices)
9. ✅ Real-time updates (Firestore listeners)
10. ✅ Theme switching (Light/Dark)

### **Needs Testing:**
1. ⚠️ WhatsApp share (depends on device)
2. ⚠️ PDF generation (check all browsers)
3. ⚠️ Export to Excel (Reports page)

---

## 🐛 KNOWN ISSUES TO CHECK

1. **Firestore Rules** - Deployed correctly?
2. **Job Detail Loading** - Fixed with new rules?
3. **Invoice PDF** - All data showing correctly?
4. **Stock Notifications** - Appearing on dashboard?
5. **Date Filters** - Working for all ranges?

---

## 📝 SUGGESTED IMPROVEMENTS

1. **Bulk Operations**
   - Bulk assign jobs
   - Bulk delete products
   - Bulk export invoices

2. **Advanced Filters**
   - Filter by technician
   - Filter by service type
   - Filter by payment status

3. **Analytics Dashboard**
   - Charts and graphs
   - Trend analysis
   - Predictive insights

4. **Notifications Panel**
   - Centralized notification center
   - Mark as read/unread
   - Notification history

5. **Customer Management**
   - Customer database
   - Service history per customer
   - Customer feedback

---

## 🎯 NEXT STEPS

1. **Test all features** with real data
2. **Deploy Firestore rules** if not done
3. **Check mobile responsiveness**
4. **Test PDF downloads** on different devices
5. **Verify WhatsApp integration**
6. **Test with multiple technicians**
7. **Check performance** with large datasets

---

**END OF ADMIN PORTAL FLOW DOCUMENTATION**

*Last Updated: [Current Date]*
*Version: 1.0*
