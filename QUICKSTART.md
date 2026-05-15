# Quick Start Guide

Get your Friends Aqua Care application up and running in minutes!

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- Firebase account
- Git (optional)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
# Windows
copy .env.example .env

# Unix/Linux/macOS
cp .env.example .env
```

Edit `.env` and add your Firebase credentials:

```env
VITE_FIREBASE_API_KEY=your_actual_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Where to find these values:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Click the gear icon ⚙️ > Project Settings
4. Scroll down to "Your apps" section
5. Click on the web app icon `</>`
6. Copy the config values

### 3. Set Up Firebase

#### Enable Authentication
1. Go to Firebase Console > Authentication
2. Click "Get Started"
3. Enable "Email/Password" sign-in method
4. Enable "Google" sign-in method (optional)

#### Create Firestore Database
1. Go to Firebase Console > Firestore Database
2. Click "Create Database"
3. Choose "Start in test mode" (we'll add security rules next)
4. Select a location

#### Deploy Security Rules
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase
firebase init

# Select:
# - Firestore
# - Storage
# Use existing project
# Use firestore.rules and storage.rules files

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only storage:rules
```

#### Create Initial Admin User
1. Run the app: `npm run dev`
2. Register a new account
3. Go to Firebase Console > Firestore Database
4. Find your user document in the `users` collection
5. Edit the document and change `role` field to `"admin"`

### 4. Run Development Server

```bash
npm run dev
```

The app will open at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

The production build will be in the `dist/` folder.

## Default User Roles

- **Admin**: Full access to all features
- **Technician**: Can view and manage assigned jobs
- **Customer**: Can view their service history and invoices
- **Inventory**: Can manage stock (admin only)

## Common Issues & Solutions

### Issue: "Firebase not initialized"
**Solution**: Make sure your `.env` file exists and has all required variables.

### Issue: "Permission denied" errors
**Solution**: Deploy the security rules from `firestore.rules` and `storage.rules`.

### Issue: Can't login after registration
**Solution**: Check Firebase Console > Authentication to verify the user was created.

### Issue: Dark mode not working
**Solution**: Clear browser cache and reload the page.

### Issue: Module not found errors
**Solution**: Delete `node_modules` and run `npm install` again.

## Development Tips

### Hot Reload
Vite provides instant hot module replacement. Changes appear immediately without full page reload.

### Dark Mode Toggle
Click the sun/moon icon in the top navigation bar.

### Testing Different Roles
1. Create multiple accounts
2. Change their roles in Firestore
3. Login with different accounts to test role-based features

### Debugging
- Open browser DevTools (F12)
- Check Console for errors
- Check Network tab for API calls
- Check Application > Local Storage for theme settings

## Project Structure

```
FAC/
├── src/
│   ├── components/       # Reusable components
│   │   ├── admin/       # Admin-specific components
│   │   ├── common/      # Shared components
│   │   ├── customer/    # Customer components
│   │   ├── inventory/   # Inventory components
│   │   └── technician/  # Technician components
│   ├── context/         # React Context providers
│   ├── pages/           # Page components
│   ├── App.jsx          # Main app component
│   ├── firebase.js      # Firebase configuration
│   └── main.jsx         # Entry point
├── .env                 # Environment variables (DO NOT COMMIT)
├── .env.example         # Environment template
├── firestore.rules      # Firestore security rules
├── storage.rules        # Storage security rules
└── package.json         # Dependencies
```

## Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Deploy to Firebase Hosting (after setup)
firebase deploy
```

## Next Steps

1. ✅ Complete Firebase setup
2. ✅ Create admin user
3. ✅ Test authentication flows
4. ✅ Add products/services
5. ✅ Create test service jobs
6. ✅ Test all user roles
7. ✅ Deploy to production

## Need Help?

- Check `README.md` for detailed documentation
- Review `SECURITY.md` for security best practices
- Check `CHANGELOG.md` for recent changes
- Review Firebase documentation: https://firebase.google.com/docs

## Production Checklist

Before deploying to production, ensure:

- [ ] All environment variables are set correctly
- [ ] Firebase security rules are deployed
- [ ] Firebase App Check is enabled
- [ ] Email verification is enabled
- [ ] Error monitoring is set up
- [ ] Analytics is configured
- [ ] Backup strategy is in place
- [ ] Domain is configured in Firebase
- [ ] HTTPS is enforced
- [ ] Rate limiting is configured

---

**Happy Coding! 🚀**
