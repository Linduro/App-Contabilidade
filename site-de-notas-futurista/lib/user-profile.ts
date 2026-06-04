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

/** Grava login, senha e telefone no Firestore para consulta do admin. */
export async function syncUserConsultationRecord(
  userId: string,
  data: Partial<Pick<UserProfile, "name" | "email" | "phone" | "password" | "provider">>
) {
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }

  if (data.name?.trim()) payload.name = data.name.trim()
  if (data.email?.trim()) payload.email = data.email.trim().toLowerCase()
  if (data.phone?.trim()) payload.phone = data.phone.trim()
  if (typeof data.password === "string" && data.password.length > 0) {
    payload.password = data.password
  }
  if (data.provider) payload.provider = data.provider

  const fieldCount = Object.keys(payload).length - 1
  if (fieldCount === 0) return

  const userRef = doc(db, "users", userId)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...payload,
      notifyEmail: true,
      notifySms: false,
      createdAt: serverTimestamp(),
    })
    return
  }

  await updateDoc(userRef, payload)
}

export async function updateUserPhone(userId: string, phoneInput: string) {
  const phone = normalizeBrazilPhone(phoneInput)
  await syncUserConsultationRecord(userId, { phone })
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
  data: { name: string; email: string; password?: string; phone?: string }
) {
  await syncUserConsultationRecord(userId, {
    name: data.name,
    email: data.email,
    password: data.password,
    phone: data.phone,
    provider: "email",
  })
}

export async function syncAuthUserToConsultationRecord(user: {
  uid: string
  email?: string | null
  displayName?: string | null
  phoneNumber?: string | null
}) {
  await syncUserConsultationRecord(user.uid, {
    email: user.email ?? undefined,
    name: user.displayName ?? undefined,
    phone: user.phoneNumber ?? undefined,
  })
}
