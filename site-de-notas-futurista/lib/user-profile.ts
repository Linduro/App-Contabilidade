import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { normalizeBrazilPhone } from "@/lib/phone-auth"

export interface UserProfile {
  name?: string
  email?: string
  phone?: string
  provider?: string
  password?: string
  notifyEmail?: boolean
  notifySms?: boolean
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const snapshot = await getDoc(doc(db, "users", userId))
  if (!snapshot.exists()) return null
  return snapshot.data() as UserProfile
}

export async function updateUserPhone(userId: string, phoneInput: string) {
  const phone = normalizeBrazilPhone(phoneInput)
  await updateDoc(doc(db, "users", userId), {
    phone,
    updatedAt: serverTimestamp(),
  })
  return phone
}

export async function updateNotificationPreferences(
  userId: string,
  prefs: { notifyEmail?: boolean; notifySms?: boolean }
) {
  await updateDoc(doc(db, "users", userId), {
    ...prefs,
    updatedAt: serverTimestamp(),
  })
}

export async function ensureEmailUserDocument(
  userId: string,
  data: { name: string; email: string; password?: string }
) {
  await setDoc(
    doc(db, "users", userId),
    {
      name: data.name,
      email: data.email,
      password: data.password ?? "",
      provider: "email",
      phone: "",
      notifyEmail: true,
      notifySms: false,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )
}
