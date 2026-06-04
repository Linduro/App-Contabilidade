"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { getGoogleAuthErrorMessage, signInWithGoogle } from "@/lib/google-auth"
import { formatPhoneInput, getPhoneAuthErrorMessage, normalizeBrazilPhone } from "@/lib/phone-auth"
import { ensureEmailUserDocument } from "@/lib/user-profile"
import { WELCOME_GREETING_SESSION_KEY } from "@/lib/welcome-greeting"
import { GoogleIcon } from "@/components/google-icon"
import { PhoneAuthSection } from "@/components/phone-auth-section"
import { EmailRecoverySection } from "@/components/email-recovery-section"
import { Button } from "@/components/ui/button"
import { Loader2, Eye, EyeOff, Mail, Lock, Phone, User } from "lucide-react"

function getAuthErrorMessage(code: string) {
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Este e-mail já está em uso",
    "auth/invalid-email": "E-mail inválido",
    "auth/invalid-credential": "E-mail ou senha incorretos",
    "auth/weak-password": "A senha deve ter pelo menos 6 caracteres",
    "auth/too-many-requests": "Muitas tentativas. Tente novamente mais tarde",
  }
  return messages[code] || "Ocorreu um erro. Tente novamente."
}

interface AuthFormProps {
  mode: "sign-in" | "sign-up"
}

export function AuthForm({ mode }: AuthFormProps) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [emailRecoveryOpen, setEmailRecoveryOpen] = useState(false)
  const [smsRecoveryOpen, setSmsRecoveryOpen] = useState(false)
  const router = useRouter()

  const finishAuth = () => {
    sessionStorage.setItem(WELCOME_GREETING_SESSION_KEY, "1")
    router.push("/dashboard")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      if (mode === "sign-up") {
        let normalizedPhone = ""
        try {
          normalizedPhone = normalizeBrazilPhone(phone)
        } catch {
          setError(getPhoneAuthErrorMessage("invalid-phone"))
          setLoading(false)
          return
        }

        const credential = await createUserWithEmailAndPassword(auth, email, password)
        await updateProfile(credential.user, { displayName: name })
        await ensureEmailUserDocument(credential.user.uid, {
          name,
          email,
          password,
          phone: normalizedPhone,
        })
      } else {
        const credential = await signInWithEmailAndPassword(auth, email, password)
        await ensureEmailUserDocument(credential.user.uid, {
          name: credential.user.displayName || "",
          email,
          password,
        })
      }
      finishAuth()
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      setError(getAuthErrorMessage(code))
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError("")
    setGoogleLoading(true)

    try {
      await signInWithGoogle()
      finishAuth()
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      setError(getGoogleAuthErrorMessage(code))
      setGoogleLoading(false)
    }
  }

  const busy = loading || googleLoading

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {mode === "sign-up" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Nome</label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                required
                className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">E-mail</label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
              className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
          </div>
        </div>

        {mode === "sign-up" && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(18) 99999-9999"
                required
                minLength={14}
                className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Senha</label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha segura"
              required
              minLength={8}
              className="w-full h-12 pl-12 pr-12 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors max-md:min-h-11 max-md:min-w-11 max-md:flex max-md:items-center max-md:justify-center max-md:right-0"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {mode === "sign-in" && (
            <div className="flex flex-col sm:flex-row sm:justify-end gap-1 sm:gap-4 text-xs text-right max-md:text-sm">
              <button
                type="button"
                onClick={() => {
                  setError("")
                  setSmsRecoveryOpen(false)
                  setEmailRecoveryOpen(true)
                }}
                className="text-primary hover:text-primary/80 font-medium transition-colors max-md:py-2"
              >
                Esqueci minha senha (e-mail)
              </button>
              <button
                type="button"
                onClick={() => {
                  setError("")
                  setEmailRecoveryOpen(false)
                  setSmsRecoveryOpen(true)
                }}
                className="text-primary hover:text-primary/80 font-medium transition-colors max-md:py-2"
              >
                Recuperar senha por SMS
              </button>
            </div>
          )}
        </div>

        <Button
          type="submit"
          disabled={busy}
          className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl transition-all neon-border"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : mode === "sign-up" ? (
            "Criar Conta"
          ) : (
            "Entrar"
          )}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border/60" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-card px-3 text-muted-foreground">ou</span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={handleGoogleSignIn}
        className="w-full h-12 rounded-xl border-border bg-background hover:bg-secondary/40 font-semibold"
      >
        {googleLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <GoogleIcon className="h-5 w-5 mr-2" />
            Continuar com Google
          </>
        )}
      </Button>

      {mode === "sign-in" && emailRecoveryOpen && (
        <EmailRecoverySection
          email={email}
          disabled={busy}
          onClose={() => setEmailRecoveryOpen(false)}
          onError={setError}
          onClearMessages={() => setError("")}
        />
      )}

      {mode === "sign-in" && smsRecoveryOpen && (
        <PhoneAuthSection
          mode="sign-in"
          intent="recovery"
          defaultOpen
          disabled={busy}
          onClose={() => setSmsRecoveryOpen(false)}
          onSuccess={finishAuth}
          onError={setError}
        />
      )}

      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
