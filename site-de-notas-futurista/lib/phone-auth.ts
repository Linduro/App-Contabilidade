import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import type { User } from "firebase/auth"
import { db } from "./firebase"

export async function ensurePhoneUserDocument(user: User, name?: string) {
  const userRef = doc(db, "users", user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      name: name?.trim() || user.displayName || "",
      email: user.email || "",
      phone: user.phoneNumber || "",
      provider: "phone",
      createdAt: serverTimestamp(),
    })
  }
}

export function normalizeBrazilPhone(input: string) {
  const digits = input.replace(/\D/g, "")

  if (digits.startsWith("55") && digits.length >= 12) {
    return `+${digits}`
  }

  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`
  }

  throw new Error("invalid-phone")
}

export function getPhoneAuthErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "auth/invalid-phone-number": "Número de telefone inválido",
    "auth/too-many-requests": "Muitas tentativas. Aguarde e tente novamente",
    "auth/code-expired": "Código expirado. Solicite um novo SMS",
    "auth/invalid-verification-code": "Código incorreto. Verifique e tente novamente",
    "auth/captcha-check-failed": "Falha na verificação de segurança. Tente novamente",
    "auth/operation-not-allowed": "Login por telefone não está habilitado no Firebase",
    "auth/missing-verification-code": "Digite o código recebido por SMS",
    "auth/quota-exceeded": "Limite de SMS atingido. Tente mais tarde",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres",
    "auth/requires-recent-login": "Confirme o SMS novamente para redefinir a senha",
  }

  if (code === "invalid-phone") {
    return "Informe um telefone válido com DDD, por exemplo (18) 99999-9999"
  }

  return messages[code] || "Não foi possível entrar com telefone. Tente novamente."
}

export function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)

  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
