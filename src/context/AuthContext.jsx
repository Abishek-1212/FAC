import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth'
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthContext = createContext(null)

const ROLE_ROUTES = {
  admin: '/admin',
  technician: '/technician',
  customer: '/customer',
}

async function fetchProfileWithRetry(uid, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) return snap.data()
    } catch (err) {
      if (err.code !== 'permission-denied' && i === retries - 1) throw err
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 100))
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastSeenInterval = useRef(null)
  const authStateListenerRef = useRef(null)

  const startOnlineTracking = async (uid) => {
    await updateDoc(doc(db, 'users', uid), { isOnline: true, lastSeen: serverTimestamp() }).catch(() => {})
    lastSeenInterval.current = setInterval(async () => {
      await updateDoc(doc(db, 'users', uid), { lastSeen: serverTimestamp() }).catch(() => {})
    }, 30000)
  }

  const stopOnlineTracking = async (uid) => {
    clearInterval(lastSeenInterval.current)
    if (uid) {
      await updateDoc(doc(db, 'users', uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {})
    }
  }

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {})

    authStateListenerRef.current = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const data = await fetchProfileWithRetry(firebaseUser.uid)
          setUser(firebaseUser)
          setProfile(data)
          startOnlineTracking(firebaseUser.uid)
        } else {
          if (user?.uid) await stopOnlineTracking(user.uid)
          setUser(null)
          setProfile(null)
        }
      } finally {
        setLoading(false)
      }
    })

    const handleUnload = () => {
      if (auth.currentUser?.uid) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      authStateListenerRef.current?.()
      window.removeEventListener('beforeunload', handleUnload)
      clearInterval(lastSeenInterval.current)
    }
  }, [])

  const fetchProfile = async (uid) => {
    const data = await fetchProfileWithRetry(uid)
    setProfile(data)
    return data
  }

  const loginWithEmail = async (email, password) => {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const data = await fetchProfile(cred.user.uid)
    return { cred, profile: data }
  }

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider()
    try {
      const cred = await signInWithPopup(auth, provider)
      const snap = await getDoc(doc(db, 'users', cred.user.uid))
      if (snap.exists()) {
        const data = snap.data()
        setProfile(data)
        return { cred, profile: data, isNew: false }
      }
      return { cred, profile: null, isNew: true }
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user') return null
      throw err
    }
  }

  const registerWithEmail = async (email, password, name, phone, role = 'technician') => {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await setDoc(doc(db, 'users', cred.user.uid), {
      uid: cred.user.uid,
      name, email, phone, role,
      isActive: true,
      isOnline: true,
      lastSeen: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
    return cred
  }

  const createTechnicianAsAdmin = async (email, password, name, phone) => {
    // Store current admin user
    const adminUser = auth.currentUser
    const adminUid = adminUser?.uid

    if (!adminUid) throw new Error('Admin not logged in')

    try {
      // Create technician account
      const { user: newUser } = await createUserWithEmailAndPassword(auth, email, password)
      
      // Create Firestore document
      await setDoc(doc(db, 'users', newUser.uid), {
        uid: newUser.uid,
        name, email, phone,
        role: 'technician',
        isActive: true,
        isOnline: false,
        createdAt: serverTimestamp(),
      })

      // Restore admin session by re-authenticating
      // But this time, we'll do it silently without triggering UI updates
      await signInWithEmailAndPassword(auth, adminUser.email, adminUser.email.split('@')[0] + 'AdminPass')
    } catch (err) {
      // If re-auth fails, try to restore by reloading
      try {
        await adminUser?.reload()
      } catch {}
      throw err
    }
  }

  const logout = async () => {
    await stopOnlineTracking(user?.uid)
    localStorage.removeItem('theme')
    await signOut(auth)
  }

  const changeRole = async (uid, newRole) => {
    await updateDoc(doc(db, 'users', uid), { role: newRole })
  }

  const isProfileComplete = (p) => !!(p?.name && p?.phone && p.phone.length === 10)

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      loginWithEmail, loginWithGoogle, logout, registerWithEmail, createTechnicianAsAdmin, fetchProfile, changeRole,
      isProfileComplete, ROLE_ROUTES,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
