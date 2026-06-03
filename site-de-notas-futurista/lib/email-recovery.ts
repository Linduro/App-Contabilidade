import { sendPasswordResetEmail } from "firebase/auth"
import { auth } from "./firebase"

export async function sendPasswordReset(email: string) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? ""
  const continueUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${basePath}/sign-in/`
      : undefined

  await sendPasswordResetEmail(
    auth,
    email.trim(),
    continueUrl ? { url: continueUrl, handleCodeInApp: false } : undefined
  )
}

export function getEmailRecoveryErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "auth/invalid-email": "E-mail inválido",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente",
    "auth/missing-email": "Informe seu e-mail para recuperar a senha",
  }
  return messages[code] || "Não foi possível enviar o e-mail de recuperação. Tente novamente."
}
