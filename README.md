# Friends Aqua Care - Service Management System

A comprehensive service management system for aqua care services with role-based access control.

## Features

- 🔐 **Authentication**: Email/Password and Google Sign-In
- 👥 **Role-Based Access**: Admin, Technician, Customer, and Inventory roles
- 📊 **Dashboard**: Real-time service job tracking
- 📦 **Inventory Management**: Stock tracking and assignment
- 🧾 **Invoice Generation**: PDF invoice creation
- 🌓 **Dark/Light Mode**: Theme toggle support

## Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd FAC
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Copy `.env.example` to `.env`
   - Add your Firebase credentials to `.env`
   - **IMPORTANT**: Never commit `.env` file to version control

4. **Run development server**
   ```bash
   npm run dev
   ```

5. **Build for production**
   ```bash
   npm run build
   ```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Security Notes

⚠️ **IMPORTANT**: 
- Never commit `.env` file to Git
- Keep Firebase credentials secure
- Use Firebase Security Rules to protect your database
- Enable Firebase App Check for production

## Tech Stack

- **Frontend**: React 18, Vite
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Routing**: React Router v6
- **Animations**: Framer Motion
- **PDF Generation**: jsPDF, html2canvas

## Project Structure

```
src/
├── components/
│   ├── admin/          # Admin dashboard components
│   ├── common/         # Shared components
│   ├── customer/       # Customer portal components
│   ├── inventory/      # Inventory management
│   └── technician/     # Technician dashboard
├── context/
│   ├── AuthContext.jsx # Authentication state
│   └── ThemeContext.jsx # Theme management
├── pages/              # Main page components
├── App.jsx             # Main app component
├── firebase.js         # Firebase configuration
└── main.jsx           # App entry point
```

## License

Private - All rights reserved
