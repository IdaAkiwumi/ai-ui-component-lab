import { ref, get, set } from 'firebase/database'
import { db } from './firebase'
import FingerprintJS from '@fingerprintjs/fingerprintjs'

// Cache the fingerprint so we only compute it once per session
let cachedFingerprint = null

async function getFingerprint() {
  if (cachedFingerprint) return cachedFingerprint
  const fp = await FingerprintJS.load()
  const result = await fp.get()
  cachedFingerprint = result.visitorId
  return cachedFingerprint
}

// Reads this user's usage from Firebase (works in incognito, across browsers)
export async function getGuestUsage() {
  try {
    const fp = await getFingerprint()
    const today = new Date().toDateString()
    const snapshot = await get(ref(db, `cl_usage/${fp}`))

    if (snapshot.exists()) {
      const data = snapshot.val()
      // If the stored date is today return it, otherwise it's a new day → reset
      return data.date === today ? data : { count: 0, date: today }
    }

    // First time this device has ever visited
    return { count: 0, date: today }
  } catch {
    // If Firebase is unreachable, fail open (don't block the user)
    return { count: 0, date: new Date().toDateString() }
  }
}

// Writes the incremented count back to Firebase
export async function incrementGuestUsage() {
  try {
    const fp = await getFingerprint()
    const usage = await getGuestUsage()
    const updated = { count: usage.count + 1, date: usage.date }
    await set(ref(db, `cl_usage/${fp}`), updated)
    return updated
  } catch {
    return null
  }
}