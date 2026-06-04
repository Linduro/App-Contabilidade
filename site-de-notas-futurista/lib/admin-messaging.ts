import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { normalizeBrazilPhone } from "@/lib/phone-auth"

export type AdminMessageChannel = "email" | "sms"

export async function queueAdminMessage(params: {
  adminUserId: string
  targetUserId?: string
  channel: AdminMessageChannel
  to: string
  message: string
}) {
  const trimmed = params.message.trim()
  if (!trimmed) throw new Error("empty-message")

  const to =
    params.channel === "sms" ? normalizeBrazilPhone(params.to.trim()) : params.to.trim()

  if (params.channel === "email" && !to.includes("@")) {
    throw new Error("invalid-email")
  }

  await addDoc(collection(db, "notificationQueue"), {
    userId: params.adminUserId,
    targetUserId: params.targetUserId ?? null,
    channel: params.channel,
    to,
    title: trimmed,
    subject: "Mensagem personalizada — App Contabilidade",
    status: "pending",
    source: "admin-custom",
    createdAt: serverTimestamp(),
  })
}
