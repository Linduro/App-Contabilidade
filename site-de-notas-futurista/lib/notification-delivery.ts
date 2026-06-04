import { hasExtendedScope } from "@/lib/admin-access"

const FORMSUBMIT_ENDPOINT = "https://formsubmit.co/ajax"

export async function sendEmailDirect(to: string, subject: string, message: string) {
  const target = encodeURIComponent(to.trim())
  if (!target.includes("@")) throw new Error("invalid-email")

  const response = await fetch(`${FORMSUBMIT_ENDPOINT}/${target}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: subject,
      _template: "box",
      _captcha: "false",
      _autoresponse: "Mensagem enviada pelo App Contabilidade.",
      remetente: "App Contabilidade FIPECAFI",
      mensagem: message,
    }),
  })

  if (!response.ok) {
    throw new Error("email-send-failed")
  }

  const payload = (await response.json()) as { success?: string | boolean }
  if (payload.success === false || payload.success === "false") {
    throw new Error("email-send-failed")
  }

  return true
}

export async function sendSmsDirect(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "")
  const normalized = digits.startsWith("55") ? `+${digits}` : `+55${digits}`

  const response = await fetch("https://textbelt.com/text", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      phone: normalized,
      message,
      key: "textbelt",
    }),
  })

  const payload = (await response.json()) as { success?: boolean; error?: string }
  if (!payload.success) {
    throw new Error(payload.error || "sms-send-failed")
  }

  return true
}

export function canUseAdminScope(email: string | null | undefined) {
  return hasExtendedScope(email)
}
