# Fix Firestore Permission Error - Setup Guide

## Problem
When technician tries to complete a job, you see error:
```
Missing or insufficient permissions
```

## Solution
You need to update your Firestore Security Rules to allow technicians to create completion reports.

## Steps to Fix

### 1. Go to Firebase Console
- Open [Firebase Console](https://console.firebase.google.com)
- Select your project
- Go to **Firestore Database** → **Rules** tab

### 2. Replace Current Rules
Delete all existing rules and paste the rules from `FIRESTORE_SECURITY_RULES.txt`

### 3. Key Rules for Completion Reports
```javascript
// Job Completion Reports collection
match /job_completion_reports/{reportId} {
  // Admin can read all reports
  allow read: if request.auth.token.role == 'admin';
  // Technician can read their own reports
  allow read: if request.auth.token.role == 'technician' && resource.data.technicianId == request.auth.uid;
  // Technician can create their own reports
  allow create: if request.auth.token.role == 'technician' && request.resource.data.technicianId == request.auth.uid;
}
```

### 4. Publish Rules
Click **Publish** button to apply the rules

### 5. Test
- Go back to the app
- Try completing a job again
- Should work now!

## Important Notes

⚠️ **Role-Based Access**
- Rules use `request.auth.token.role` which comes from custom claims
- Make sure your users have the correct role set in Firebase Authentication

### How to Set User Roles (Admin Only)

1. Go to Firebase Console → Authentication
2. Click on a user
3. Go to **Custom Claims** tab
4. Add this JSON:
```json
{
  "role": "technician"
}
```

Or for admin:
```json
{
  "role": "admin"
}
```

## Rule Breakdown

| Collection | Technician | Admin |
|-----------|-----------|-------|
| service_jobs | Read own assigned jobs | Read/Write all |
| job_stock_assignment | Read/Update own | Read/Write all |
| job_completion_reports | Create/Read own | Read all |
| inventory | Read only | Read/Write |
| stock_transactions | Create/Read | Create/Read |

## If Still Getting Error

1. **Check user role**: Make sure user has `role: "technician"` in custom claims
2. **Check collection name**: Ensure it's exactly `job_completion_reports` (case-sensitive)
3. **Check user ID**: Verify `technicianId` matches `request.auth.uid`
4. **Wait for rules to publish**: Sometimes takes 30 seconds

## Testing Rules

Firebase provides a Rules Simulator:
1. In Rules tab, click **Rules Simulator** (bottom right)
2. Select **Read** or **Write**
3. Enter collection path: `job_completion_reports`
4. Enter document ID: any ID
5. Set **Authentication** to your user
6. Click **Run** to test

## Common Issues

### Issue: "Missing or insufficient permissions"
**Solution**: Check if user has `role: "technician"` in custom claims

### Issue: "Document not found"
**Solution**: Make sure you're creating the document with correct structure

### Issue: Rules won't publish
**Solution**: Check for syntax errors in rules (use Rules Simulator to validate)

## Need Help?

If you still get errors:
1. Check browser console for exact error message
2. Go to Firebase Console → Firestore → Logs
3. Look for permission denied errors
4. Verify user role in Authentication → Custom Claims
