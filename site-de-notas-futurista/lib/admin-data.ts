import { collection, doc, getDoc, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { ProgressionData } from "@/lib/progression-data"
import { normalizeProgressionData } from "@/lib/progression-data"

export interface AdminUserRecord {
  id: string
  name?: string
  email?: string
  phone?: string
  provider?: string
  password?: string
}

export async function fetchAllUsersForAdmin(): Promise<AdminUserRecord[]> {
  const snapshot = await getDocs(collection(db, "users"))
  return snapshot.docs
    .map((item) => ({
      id: item.id,
      ...(item.data() as Omit<AdminUserRecord, "id">),
    }))
    .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""))
}

export async function fetchUserProgressionForAdmin(
  userId: string
): Promise<ProgressionData | null> {
  const snapshot = await getDoc(doc(db, "users", userId, "progression", "main"))
  if (!snapshot.exists()) return null
  return normalizeProgressionData(snapshot.data())
}
