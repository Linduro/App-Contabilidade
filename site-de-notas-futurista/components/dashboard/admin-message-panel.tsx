"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail, MessageSquare, Send, Smartphone } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { formatPhoneInput } from "@/lib/phone-auth"
import { sendAdminMessage, type AdminMessageChannel } from "@/lib/admin-messaging"

interface AdminMessagePanelProps {
  selectedUser?: {
    id: string
    email?: string
    phone?: string
    name?: string
  } | null
}

export function AdminMessagePanel({ selectedUser }: AdminMessagePanelProps) {
  const { user } = useAuth()
  const [channel, setChannel] = useState<AdminMessageChannel>("email")
  const [to, setTo] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!selectedUser) return
    fillFromUser(channel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.id])

  const fillFromUser = (nextChannel: AdminMessageChannel) => {
    if (!selectedUser) return
    if (nextChannel === "email") {
      setTo(selectedUser.email || "")
    } else {
      const phone = selectedUser.phone || ""
      setTo(phone ? formatPhoneInput(phone.replace(/^\+55/, "")) : "")
    }
  }

  const handleChannelChange = (next: AdminMessageChannel) => {
    setChannel(next)
    fillFromUser(next)
  }

  const handleSend = async () => {
    if (!user) return

    setError("")
    setFeedback("")
    setSending(true)

    try {
      await sendAdminMessage({
        adminUserId: user.uid,
        targetUserId: selectedUser?.id,
        channel,
        to,
        message,
      })
      setFeedback(
        channel === "email"
          ? "E-mail enviado com sucesso."
          : "SMS enviado com sucesso."
      )
      setMessage("")
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message === "empty-message") {
          setError("Escreva a mensagem antes de enviar.")
        } else if (err.message === "invalid-email") {
          setError("Informe um e-mail válido.")
        } else if (err.message === "invalid-phone") {
          setError("Informe um telefone válido com DDD.")
        } else {
          setError("Não foi possível enfileirar a mensagem.")
        }
      } else {
        setError("Não foi possível enfileirar a mensagem.")
      }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-primary flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          Mensagem personalizada
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Envie SMS ou e-mail para qualquer número ou endereço. Selecione um usuário à esquerda
          para preencher o destino automaticamente.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => handleChannelChange("email")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
            channel === "email"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          E-mail
        </button>
        <button
          type="button"
          onClick={() => handleChannelChange("sms")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
            channel === "sms"
              ? "border-primary bg-primary/15 text-primary"
              : "border-border text-muted-foreground hover:border-primary/40"
          }`}
        >
          <Smartphone className="w-3.5 h-3.5" />
          SMS
        </button>
        {selectedUser && (
          <button
            type="button"
            onClick={() => fillFromUser(channel)}
            className="text-xs text-primary hover:underline ml-auto"
          >
            Usar dados de {selectedUser.name || "usuário selecionado"}
          </button>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground/80">
          {channel === "email" ? "E-mail destino" : "Telefone destino"}
        </label>
        <input
          type={channel === "email" ? "email" : "tel"}
          value={to}
          onChange={(e) =>
            setTo(
              channel === "sms" ? formatPhoneInput(e.target.value) : e.target.value
            )
          }
          placeholder={channel === "email" ? "aluno@email.com" : "(18) 99999-9999"}
          className="w-full h-10 px-3 bg-background/80 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-foreground/80">Mensagem</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Escreva a mensagem personalizada..."
          className="w-full px-3 py-2 bg-background/80 border border-border rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      {feedback && <p className="text-xs text-primary">{feedback}</p>}

      <Button type="button" onClick={handleSend} disabled={sending} className="rounded-xl">
        {sending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Enviar mensagem
          </>
        )}
      </Button>
    </div>
  )
}
