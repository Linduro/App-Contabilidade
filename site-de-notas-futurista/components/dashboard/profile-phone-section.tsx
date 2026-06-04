"use client"

import { useEffect, useState } from "react"
import { Loader2, Mail, Phone, Smartphone } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { formatPhoneInput, getPhoneAuthErrorMessage } from "@/lib/phone-auth"
import {
  getUserProfile,
  updateNotificationPreferences,
  updateUserPhone,
} from "@/lib/user-profile"

export function ProfilePhoneSection() {
  const { user } = useAuth()
  const [phone, setPhone] = useState("")
  const [savedPhone, setSavedPhone] = useState("")
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifySms, setNotifySms] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  useEffect(() => {
    if (!user) return

    getUserProfile(user.uid)
      .then((profile) => {
        const existing = profile?.phone || user.phoneNumber || ""
        setPhone(existing ? formatPhoneInput(existing.replace(/^\+55/, "")) : "")
        setSavedPhone(existing)
        setNotifyEmail(profile?.notifyEmail !== false)
        setNotifySms(profile?.notifySms === true)
      })
      .finally(() => setLoading(false))
  }, [user])

  const handleSave = async () => {
    if (!user) return

    setError("")
    setMessage("")
    setSaving(true)

    try {
      const normalized = await updateUserPhone(user.uid, phone)
      setSavedPhone(normalized)
      await updateNotificationPreferences(user.uid, { notifyEmail, notifySms })
      setMessage("Contato e preferências de notificação salvos.")
    } catch (err: unknown) {
      if (err instanceof Error && err.message === "invalid-phone") {
        setError(getPhoneAuthErrorMessage("invalid-phone"))
      } else {
        setError("Não foi possível salvar. Tente novamente.")
      }
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="glass-card rounded-2xl p-6 neon-border mb-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </section>
    )
  }

  return (
    <section className="glass-card rounded-2xl p-6 neon-border mb-8" data-tour="profile-phone">
      <h3 className="text-lg font-bold text-primary flex items-center gap-2 mb-1">
        <Smartphone className="w-5 h-5" />
        Meu contato e notificações
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Cadastre seu celular quando quiser para receber lembretes por SMS. O e-mail da conta pode
        receber avisos de prazos.
      </p>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground/80">Celular (opcional)</label>
          <div className="relative max-w-sm">
            <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
              placeholder="(18) 99999-9999"
              className="w-full h-11 pl-11 pr-4 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {savedPhone && (
            <p className="text-xs text-muted-foreground">Número salvo: {savedPhone}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.checked)}
              className="rounded border-border"
            />
            <Mail className="w-4 h-4 text-primary" />
            Receber lembretes por e-mail
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={notifySms}
              onChange={(e) => setNotifySms(e.target.checked)}
              disabled={!phone.replace(/\D/g, "").length}
              className="rounded border-border disabled:opacity-50"
            />
            <Phone className="w-4 h-4 text-primary" />
            Receber lembretes por SMS
          </label>
        </div>

        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {message && (
          <p className="text-sm text-primary">{message}</p>
        )}

        <Button type="button" onClick={handleSave} disabled={saving} className="rounded-xl">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Salvar contato"}
        </Button>
      </div>
    </section>
  )
}
