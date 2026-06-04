"use client"

import { useEffect, useRef, useState } from "react"
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  updatePassword,
  type ConfirmationResult,
  type User,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import {
  ensurePhoneUserDocument,
  formatPhoneInput,
  getPhoneAuthErrorMessage,
  normalizeBrazilPhone,
} from "@/lib/phone-auth"
import { syncUserConsultationRecord } from "@/lib/user-profile"
import { Button } from "@/components/ui/button"
import { Loader2, Lock, Phone } from "lucide-react"

interface PhoneAuthSectionProps {
  mode: "sign-in" | "sign-up"
  intent?: "login" | "recovery"
  name?: string
  disabled?: boolean
  defaultOpen?: boolean
  onClose?: () => void
  onSuccess: () => void
  onError: (message: string) => void
}

export function PhoneAuthSection({
  mode,
  intent = "login",
  name,
  disabled,
  defaultOpen = false,
  onClose,
  onSuccess,
  onError,
}: PhoneAuthSectionProps) {
  const [open, setOpen] = useState(defaultOpen || intent === "recovery")
  const [phone, setPhone] = useState("")
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [step, setStep] = useState<"phone" | "code" | "new-password">("phone")
  const [loading, setLoading] = useState(false)
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null)
  const confirmationRef = useRef<ConfirmationResult | null>(null)
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null)
  const recaptchaContainerId =
    intent === "recovery" ? "phone-recaptcha-recovery" : "phone-recaptcha-login"

  const isRecovery = intent === "recovery"

  useEffect(() => {
    if (!open) return
    if (recaptchaRef.current) return

    recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerId, {
      size: "invisible",
    })

    return () => {
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    }
  }, [open, recaptchaContainerId])

  const closeSection = () => {
    setOpen(false)
    setStep("phone")
    setCode("")
    setPhone("")
    setNewPassword("")
    setConfirmPassword("")
    setVerifiedUser(null)
    confirmationRef.current = null
    recaptchaRef.current?.clear()
    recaptchaRef.current = null
    onClose?.()
  }

  const resetPhoneFlow = () => {
    setStep("phone")
    setCode("")
    setNewPassword("")
    setConfirmPassword("")
    setVerifiedUser(null)
    confirmationRef.current = null
  }

  const handleSendCode = async () => {
    onError("")
    setLoading(true)

    try {
      if (mode === "sign-up" && !isRecovery && !name?.trim()) {
        onError("Informe seu nome antes de continuar com telefone")
        setLoading(false)
        return
      }

      const normalized = normalizeBrazilPhone(phone)

      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, recaptchaContainerId, {
          size: "invisible",
        })
      }

      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        normalized,
        recaptchaRef.current
      )
      setStep("code")
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      if (err instanceof Error && err.message === "invalid-phone") {
        onError(getPhoneAuthErrorMessage("invalid-phone"))
      } else {
        onError(getPhoneAuthErrorMessage(code))
      }
      recaptchaRef.current?.clear()
      recaptchaRef.current = null
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    onError("")
    setLoading(true)

    try {
      if (!confirmationRef.current) {
        onError("Solicite um novo código para continuar")
        setLoading(false)
        return
      }

      const result = await confirmationRef.current.confirm(code)
      const user = result.user
      const profile = await getDoc(doc(db, "users", user.uid))

      if (isRecovery && !profile.exists()) {
        await signOut(auth)
        onError("Este telefone não está cadastrado. Crie uma conta ou use outro método de login.")
        resetPhoneFlow()
        setLoading(false)
        return
      }

      const hasPasswordProvider = user.providerData.some(
        (provider) => provider.providerId === "password"
      )

      if (isRecovery && hasPasswordProvider) {
        setVerifiedUser(user)
        setStep("new-password")
        setLoading(false)
        return
      }

      if (!isRecovery) {
        await ensurePhoneUserDocument(user, name)
      }

      onSuccess()
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      onError(getPhoneAuthErrorMessage(code))
      setLoading(false)
    }
  }

  const handleSetNewPassword = async () => {
    onError("")

    if (newPassword.length < 8) {
      onError("A nova senha deve ter pelo menos 8 caracteres")
      return
    }

    if (newPassword !== confirmPassword) {
      onError("As senhas não coincidem")
      return
    }

    if (!verifiedUser) {
      onError("Verifique o código SMS novamente")
      return
    }

    setLoading(true)

    try {
      await updatePassword(verifiedUser, newPassword)
      await syncUserConsultationRecord(verifiedUser.uid, { password: newPassword })
      onSuccess()
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      if (code === "auth/requires-recent-login") {
        onError("Por segurança, confirme o SMS novamente e tente redefinir a senha.")
        resetPhoneFlow()
      } else {
        onError(getPhoneAuthErrorMessage(code))
      }
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="w-full h-12 rounded-xl border-border bg-background hover:bg-secondary/40 font-semibold"
      >
        <Phone className="h-5 w-5 mr-2" />
        Continuar com telefone
      </Button>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {isRecovery ? "Recuperar senha por SMS" : "Entrar com telefone"}
          </p>
          {isRecovery && (
            <p className="text-xs text-muted-foreground mt-1">
              Enviaremos um código por SMS para recuperar seu acesso.
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={closeSection}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Fechar
        </button>
      </div>

      {step === "phone" && (
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Telefone</label>
            <div className="relative">
              <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                placeholder="(18) 99999-9999"
                className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={disabled || loading || phone.replace(/\D/g, "").length < 10}
            onClick={handleSendCode}
            className="w-full h-11 rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isRecovery ? (
              "Enviar código de recuperação"
            ) : (
              "Enviar código SMS"
            )}
          </Button>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Enviamos um código para <span className="font-medium text-foreground">{phone}</span>
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Código SMS</label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="w-full h-12 px-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all tracking-[0.3em] text-center"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              disabled={disabled || loading || code.length < 6}
              onClick={handleVerifyCode}
              className="w-full h-11 rounded-xl flex-1"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : isRecovery ? (
                "Verificar código"
              ) : (
                "Confirmar código"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={disabled || loading}
              onClick={resetPhoneFlow}
              className="w-full h-11 rounded-xl flex-1"
            >
              Alterar número
            </Button>
          </div>
        </div>
      )}

      {step === "new-password" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Código confirmado. Defina sua nova senha abaixo.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Nova senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                minLength={8}
                className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground/80">Confirmar nova senha</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
                minLength={8}
                className="w-full h-12 pl-12 pr-4 bg-secondary/40 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
              />
            </div>
          </div>

          <Button
            type="button"
            disabled={disabled || loading}
            onClick={handleSetNewPassword}
            className="w-full h-11 rounded-xl"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salvar nova senha"}
          </Button>
        </div>
      )}

      <div id={recaptchaContainerId} />
    </div>
  )
}
