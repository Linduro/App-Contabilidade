"use client"

import { Bell, Mail, Plus, Smartphone, Trash2 } from "lucide-react"
import type { Reminder } from "@/lib/progression-data"
import { createReminder } from "@/lib/progression-data"

export function RemindersSection({
  reminders,
  onChange,
}: {
  reminders: Reminder[]
  onChange: (reminders: Reminder[]) => void
}) {
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

  return (
    <section className="glass-card rounded-2xl p-6 neon-border mb-8" data-tour="reminders">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-primary flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Lembretes e prazos
        </h3>
        <button
          type="button"
          onClick={addReminder}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Ative e-mail e SMS por lembrete. Os avisos são enviados no dia do prazo e um dia antes,
        conforme seu contato cadastrado abaixo no painel.
      </p>

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
                className={`flex flex-col gap-2 p-3 rounded-xl border ${
                  reminder.done
                    ? "bg-secondary/30 border-border/50 opacity-60"
                    : overdue
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-secondary/20 border-border/50"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <input
                    type="checkbox"
                    checked={reminder.done}
                    onChange={(e) => updateReminder(index, { ...reminder, done: e.target.checked })}
                    className="shrink-0"
                  />
                  <input
                    type="text"
                    value={reminder.title}
                    onChange={(e) => updateReminder(index, { ...reminder, title: e.target.value })}
                    placeholder="Ex: Prova de Contabilidade"
                    className="flex-1 bg-transparent border border-dashed border-border rounded-lg px-3 py-1.5 text-sm focus:border-primary outline-none"
                  />
                  <input
                    type="date"
                    value={reminder.date}
                    onChange={(e) =>
                      updateReminder(index, { ...reminder, date: e.target.value, notifiedOn: null })
                    }
                    className="bg-secondary/40 border border-border rounded-lg px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => deleteReminder(index)}
                    className="p-2 text-muted-foreground hover:text-destructive self-end sm:self-center"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap gap-4 pl-0 sm:pl-6 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={reminder.notifyEmail !== false}
                      onChange={(e) =>
                        updateReminder(index, { ...reminder, notifyEmail: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    <Mail className="w-3.5 h-3.5" />
                    E-mail
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={reminder.notifySms === true}
                      onChange={(e) =>
                        updateReminder(index, { ...reminder, notifySms: e.target.checked })
                      }
                      className="rounded border-border"
                    />
                    <Smartphone className="w-3.5 h-3.5" />
                    SMS
                  </label>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
