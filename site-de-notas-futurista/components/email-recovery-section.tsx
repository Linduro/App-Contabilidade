"use client"

import { useState } from "react"
import { getEmailRecoveryErrorMessage, sendPasswordReset } from "@/lib/email-recovery"
import { Button } from "@/components/ui/button"
import { Loader2, Mail } from "lucide-react"

interface EmailRecoverySectionProps {
  email: string
  disabled?: boolean
  onClose: () => void
  onError: (message: string) => void
  onClearMessages: () => void
}

export function EmailRecoverySection({
  email,
  disabled,
  onClose,
  onError,
  onClearMessages,
}: EmailRecoverySectionProps) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSend = async () => {
    onClearMessages()

    if (!email.trim()) {
      onError("Informe seu e-mail no formulário acima para recuperar a senha")
      return
    }

    setLoading(true)

    try {
      await sendPasswordReset(email)
      setSent(true)
    } catch (err: unknown) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : ""
      onError(getEmailRecoveryErrorMessage(code))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4 rounded-xl border border-border/60 bg-secondary/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Recuperar senha por e-mail</p>
          <p className="text-xs text-muted-foreground mt-1">
            Enviaremos um link do Firebase para redefinir sua senha.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
        >
          Fechar
        </button>
      </div>

      {sent ? (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-foreground">
          Se existir uma conta com <span className="font-medium">{email.trim()}</span>, você
          receberá um e-mail com instruções para redefinir a senha. Verifique também a caixa de
          spam.
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            E-mail de recuperação:{" "}
            <span className="font-medium text-foreground">
              {email.trim() || "preencha o campo acima"}
            </span>
          </p>

          <Button
            type="button"
            disabled={disabled || loading || !email.trim()}
            onClick={handleSend}
            className="w-full h-11 rounded-xl"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Enviar link de recuperação
              </>
            )}
          </Button>
        </>
      )}
    </div>
  )
}
