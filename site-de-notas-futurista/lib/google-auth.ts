import { GoogleAuthProvider, signInWithPopup, type User } from "firebase/auth"
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore"
import { auth, db } from "./firebase"

const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: "select_account" })

async function ensureUserDocument(user: User) {
  const userRef = doc(db, "users", user.uid)
  const snapshot = await getDoc(userRef)

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      name: user.displayName ?? "",
      email: user.email ?? "",
      phone: user.phoneNumber ?? "",
      photoURL: user.photoURL ?? "",
      provider: "google",
      notifyEmail: true,
      notifySms: false,
      createdAt: serverTimestamp(),
    })
  }
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider)
  await ensureUserDocument(result.user)
  return result.user
}

export function getGoogleAuthErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "auth/popup-closed-by-user": "Login com Google cancelado",
    "auth/popup-blocked": "Permita pop-ups neste site para entrar com Google",
    "auth/cancelled-popup-request": "Aguarde e tente entrar com Google novamente",
    "auth/account-exists-with-different-credential":
      "Este e-mail já está cadastrado com senha. Use e-mail e senha para entrar.",
    "auth/operation-not-allowed": "Login com Google não está habilitado no Firebase",
  }
  return messages[code] || "Não foi possível entrar com Google. Tente novamente."
}
