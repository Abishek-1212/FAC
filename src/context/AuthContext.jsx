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
  inventory_manager: '/inventory',
  technician: '/technician',
  customer: '/customer',
}

async function fetchProfileWithRetry(uid, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const snap = await getDoc(doc(db, 'users', uid))
    if (snap.exists()) return snap.data()
    if (i < retries - 1) await new Promise(r => setTimeout(r, 100))
  }
  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const lastSeenInterval = useRef(null)

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

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
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
      setLoading(false)
    })

    const handleUnload = () => {
      if (auth.currentUser?.uid) {
        updateDoc(doc(db, 'users', auth.currentUser.uid), { isOnline: false, lastSeen: serverTimestamp() }).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handleUnload)

    return () => {
      unsub()
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

  const registerWithEmail = async (email, password, name, phone, role = 'customer') => {
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

  const logout = async () => {
    await stopOnlineTracking(user?.uid)
    await signOut(auth)
  }

  const changeRole = async (uid, newRole) => {
    await updateDoc(doc(db, 'users', uid), { role: newRole })
  }

  const isProfileComplete = (p) => !!(p?.name && p?.phone && p.phone.length === 10)

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      loginWithEmail, loginWithGoogle, logout, registerWithEmail, fetchProfile, changeRole,
      isProfileComplete, ROLE_ROUTES,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
