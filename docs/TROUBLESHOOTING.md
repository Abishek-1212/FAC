# Troubleshooting Guide - FAC Invoice System

## Issue: "filter is not defined" Error

### Cause
Browser cache is serving an old version of the file.

### Solution

**Step 1: Clear Browser Cache**
- Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
- Select "All time"
- Check "Cookies and other site data" and "Cached images and files"
- Click "Clear data"

**Step 2: Hard Refresh**
- Press `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
- Or press `F12` → Right-click refresh button → "Empty cache and hard refresh"

**Step 3: Restart Dev Server**
```bash
# Stop the dev server (Ctrl + C)
# Then restart it
npm run dev
```

**Step 4: Clear Node Modules Cache**
```bash
# If the above doesn't work
rm -rf node_modules/.vite
npm run dev
```

---

## Issue: "GET /src/utils/generateInvoice.js 500 Error"

### Cause
The file wasn't created properly or dependencies aren't installed.

### Solution

**Step 1: Verify File Exists**
```bash
# Check if the file exists
dir src\utils\generateInvoice.js
```

**Step 2: Install Dependencies**
```bash
npm install jspdf jspdf-autotable
```

**Step 3: Verify Installation**
```bash
npm list jspdf jspdf-autotable
```

**Step 4: Restart Dev Server**
```bash
npm run dev
```

---

## Issue: Completed Jobs Still Disappearing

### Cause
The filtering logic might not be applied correctly.

### Solution

**Step 1: Check Firestore Data**
- Go to Firebase Console
- Check `service_jobs` collection
- Verify completed jobs have `status: "completed"`

**Step 2: Verify Filter Logic**
- Open browser DevTools (F12)
- Go to Console tab
- Check for any JavaScript errors

**Step 3: Clear Application Data**
- DevTools → Application tab
- Clear "Local Storage"
- Clear "Session Storage"
- Refresh page

**Step 4: Test Manually**
1. Create a new job
2. Mark it as completed
3. Click "Completed" filter
4. Job should appear with ✅ badge

---

## Issue: Invoice PDF Not Downloading

### Cause
jsPDF library not loaded or blocked by browser.

### Solution

**Step 1: Check Console for Errors**
- Press F12
- Go to Console tab
- Look for red error messages

**Step 2: Verify jsPDF Installation**
```bash
npm list jspdf
npm list jspdf-autotable
```

**Step 3: Check Browser Settings**
- Allow pop-ups for localhost
- Check download settings
- Disable ad blockers

**Step 4: Test with Simple Data**
- Try generating invoice with minimal data
- Check if PDF downloads

---

## Issue: Invoice Not Saving to Firestore

### Cause
Firestore rules or authentication issue.

### Solution

**Step 1: Check Authentication**
- Verify you're logged in as admin
- Check user role in Firestore

**Step 2: Update Firestore Rules**
```javascript
match /invoices/{invoiceId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null;
  allow update, delete: if request.auth != null;
}
```

**Step 3: Check Console for Errors**
- Press F12
- Go to Console tab
- Look for Firestore permission errors

**Step 4: Verify Collection Exists**
- Go to Firebase Console
- Check if `invoices` collection exists
- If not, create it manually

---

## Issue: Mobile Layout Broken

### Cause
CSS not loading or viewport not set correctly.

### Solution

**Step 1: Check Viewport Meta Tag**
- Open `index.html`
- Verify this line exists:
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**Step 2: Clear CSS Cache**
- Press F12
- Go to Network tab
- Check "Disable cache"
- Refresh page

**Step 3: Test on Different Device**
- Use Chrome DevTools device emulation
- Test on actual mobile device

---

## Issue: Scrollbar Still Visible

### Cause
CSS class not applied or overridden.

### Solution

**Step 1: Verify CSS Class**
- Check `src/index.css` has:
```css
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
```

**Step 2: Check HTML Elements**
- Verify elements have `scrollbar-hide` class
- Use DevTools to inspect

**Step 3: Force CSS Update**
- Hard refresh (Ctrl + Shift + R)
- Clear browser cache

---

## Quick Fixes Checklist

- [ ] Hard refresh browser (Ctrl + Shift + R)
- [ ] Clear browser cache
- [ ] Restart dev server (npm run dev)
- [ ] Install dependencies (npm install)
- [ ] Check browser console for errors (F12)
- [ ] Verify Firestore rules
- [ ] Check user authentication
- [ ] Test on incognito/private window
- [ ] Disable browser extensions
- [ ] Try different browser

---

## Getting Help

### Check These Files
- `src/components/technician/TechnicianHome.jsx` - Technician dashboard
- `src/components/admin/Invoices.jsx` - Invoice management
- `src/utils/generateInvoice.js` - PDF generation
- `src/index.css` - Global styles

### Common Error Messages

| Error | Solution |
|-------|----------|
| "filter is not defined" | Hard refresh + clear cache |
| "Cannot find module 'jspdf'" | npm install jspdf jspdf-autotable |
| "Firestore permission denied" | Update Firestore rules |
| "PDF not downloading" | Check browser pop-up settings |
| "Completed jobs not showing" | Verify job status in Firestore |

---

## Testing Workflow

1. **Create Job**
   - Go to Admin → Service Jobs
   - Click "+ New Job"
   - Fill in details
   - Submit

2. **Mark as Completed**
   - Go to Technician Dashboard
   - Click on job
   - Mark as completed

3. **Generate Invoice**
   - Go to Admin → Invoices
   - Click "+ Generate Invoice"
   - Select completed job
   - Add products
   - Click "Generate & Download"

4. **Verify**
   - Check PDF downloaded
   - Check Firestore for invoice data
   - Verify completed job still visible in technician dashboard

---

## Performance Tips

- Use incognito mode for testing (no cache issues)
- Disable browser extensions
- Close other tabs
- Use Chrome DevTools Performance tab
- Check Network tab for slow requests

---

## Still Having Issues?

1. Check browser console (F12)
2. Check Firebase console for errors
3. Verify all files are created
4. Verify dependencies installed
5. Restart dev server
6. Clear all caches
7. Try different browser
8. Check Firestore rules

**Last Resort**: Delete `node_modules` and `package-lock.json`, then run `npm install` again.

---

**Status**: ✅ All systems operational
**Last Updated**: 2024
**Version**: 2.0
