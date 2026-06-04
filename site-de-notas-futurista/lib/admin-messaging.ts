import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { sendEmailDirect, sendSmsDirect } from "@/lib/notification-delivery"
import { normalizeBrazilPhone } from "@/lib/phone-auth"

export type AdminMessageChannel = "email" | "sms"

export async function sendAdminMessage(params: {
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

  if (params.channel === "email") {
    await sendEmailDirect(to, "Mensagem personalizada — App Contabilidade", trimmed)
  } else {
    await sendSmsDirect(to, trimmed)
  }

  try {
    await addDoc(collection(db, "notificationQueue"), {
      userId: params.adminUserId,
      targetUserId: params.targetUserId ?? null,
      channel: params.channel,
      to,
      title: trimmed,
      subject: "Mensagem personalizada — App Contabilidade",
      status: "sent",
      source: "admin-custom",
      createdAt: serverTimestamp(),
    })
  } catch {
    // Histórico opcional — o envio principal já ocorreu.
  }
}
