"use client"

import { useEffect, useState } from "react"
import { Bell, Mail, Plus, Trash2 } from "lucide-react"
import { useAuth } from "@/components/auth-provider"
import type { Reminder } from "@/lib/progression-data"
import { createReminder } from "@/lib/progression-data"
import { getUserProfile, updateNotificationPreferences } from "@/lib/user-profile"

export function RemindersSection({
  reminders,
  onChange,
}: {
  reminders: Reminder[]
  onChange: (reminders: Reminder[]) => void
}) {
  const { user } = useAuth()
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [prefsLoading, setPrefsLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    getUserProfile(user.uid)
      .then((profile) => setNotifyEmail(profile?.notifyEmail !== false))
      .finally(() => setPrefsLoading(false))
  }, [user])

  const handleNotifyEmailChange = async (enabled: boolean) => {
    setNotifyEmail(enabled)
    if (!user) return

    try {
      await updateNotificationPreferences(user.uid, { notifyEmail: enabled })
    } catch {
      setNotifyEmail(!enabled)
    }
  }

  const addReminder = () => onChange([...reminders, createReminder()])

  const updateReminder = (index: number, updated: Reminder) => {
    const next = [...reminders]
    next[index] = updated
    onChange(next)
  }

  const deleteReminder = (index: number) => {
    onChange(reminders.filter((_, i) => i !== index))
  }

  const sorted = [...reminders].sort((a, b) => a.date.localeCompare(b.date))
  const accountEmail = user?.email ?? ""

  return (
    <section className="glass-card rounded-2xl p-6 neon-border mb-8 max-md:p-4" data-tour="reminders">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-primary flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Lembretes e prazos
        </h3>
        <button
          type="button"
          onClick={addReminder}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1 max-md:min-h-10 max-md:px-4 max-md:text-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-border/50 bg-secondary/20 px-4 py-3">
        <p className="text-xs text-muted-foreground mb-3">
          Ative os lembretes por e-mail. Os avisos são enviados no dia do prazo e um dia antes, conforme
          seu contato cadastrado abaixo no painel.
        </p>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={notifyEmail}
            disabled={prefsLoading || !accountEmail}
            onChange={(e) => handleNotifyEmailChange(e.target.checked)}
            className="rounded border-border max-md:h-5 max-md:w-5"
          />
          <Mail className="w-4 h-4 text-primary shrink-0" />
          <span>Receber avisos por e-mail</span>
        </label>
        {accountEmail && (
          <p className="text-xs text-muted-foreground mt-2 pl-6">{accountEmail}</p>
        )}
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lembrete. Adicione provas, entregas ou prazos.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((reminder) => {
            const index = reminders.findIndex((r) => r.id === reminder.id)
            const overdue = !reminder.done && reminder.date < new Date().toISOString().slice(0, 10)
            return (
              <li
                key={reminder.id}
                className={`flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border ${
                  reminder.done
                    ? "bg-secondary/30 border-border/50 opacity-60"
                    : overdue
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-secondary/20 border-border/50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={reminder.done}
                  onChange={(e) => updateReminder(index, { ...reminder, done: e.target.checked })}
                  className="shrink-0 max-md:h-5 max-md:w-5"
                />
                <input
                  type="text"
                  value={reminder.title}
                  onChange={(e) => updateReminder(index, { ...reminder, title: e.target.value })}
                  placeholder="Ex: Prova de Contabilidade"
                  className="flex-1 bg-transparent border border-dashed border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none max-md:w-full"
                />
                <input
                  type="date"
                  value={reminder.date}
                  onChange={(e) =>
                    updateReminder(index, { ...reminder, date: e.target.value, notifiedOn: null })
                  }
                  className="bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-sm max-md:w-full"
                />
                <button
                  type="button"
                  onClick={() => deleteReminder(index)}
                  className="p-2 text-muted-foreground hover:text-destructive self-end sm:self-center max-md:min-h-10 max-md:min-w-10 max-md:flex max-md:items-center max-md:justify-center"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
