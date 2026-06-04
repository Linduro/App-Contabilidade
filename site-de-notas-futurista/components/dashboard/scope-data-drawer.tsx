"use client"

import { useEffect, useState } from "react"
import { Loader2, X } from "lucide-react"
import { fetchAllUsersForAdmin, fetchUserProgressionForAdmin } from "@/lib/admin-data"
import type { ProgressionData } from "@/lib/progression-data"
import { Button } from "@/components/ui/button"

interface ScopeDataDrawerProps {
  open: boolean
  onClose: () => void
}

export function ScopeDataDrawer({ open, onClose }: ScopeDataDrawerProps) {
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingProgression, setLoadingProgression] = useState(false)
  const [users, setUsers] = useState<
    { id: string; name?: string; email?: string; phone?: string; provider?: string }[]
  >([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [progression, setProgression] = useState<ProgressionData | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return

    setError("")
    setLoadingUsers(true)
    setSelectedUserId(null)
    setProgression(null)

    fetchAllUsersForAdmin()
      .then(setUsers)
      .catch((err: unknown) => {
        const code =
          err && typeof err === "object" && "code" in err ? String(err.code) : ""
        if (code === "permission-denied") {
          setError(
            "Sem permissão para listar contas. Entre com cartoonhq@gmail.com e confirme que as regras do Firestore foram publicadas."
          )
        } else {
          setError("Não foi possível carregar os registros.")
        }
      })
      .finally(() => setLoadingUsers(false))
  }, [open])

  const loadProgression = async (userId: string) => {
    setSelectedUserId(userId)
    setLoadingProgression(true)
    setError("")
    setProgression(null)

    try {
      const data = await fetchUserProgressionForAdmin(userId)
      setProgression(data)
    } catch {
      setError("Não foi possível carregar os dados deste registro.")
    } finally {
      setLoadingProgression(false)
    }
  }

  if (!open) return null

  const selectedUser = users.find((item) => item.id === selectedUserId)

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/85 backdrop-blur-sm">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden glass-card neon-border rounded-2xl shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/50">
          <div>
            <h2 className="text-lg font-bold text-foreground">Consulta de registros</h2>
            <p className="text-xs text-muted-foreground mt-1">
              Visualização de progressão acadêmica por conta.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid lg:grid-cols-[280px_1fr] min-h-0 flex-1">
          <div className="border-b lg:border-b-0 lg:border-r border-border/50 p-4 overflow-y-auto">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Contas ({users.length})
            </p>

            {loadingUsers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : users.length === 0 && !error ? (
              <p className="text-sm text-muted-foreground">Nenhuma conta encontrada.</p>
            ) : (
              <div className="space-y-2">
                {users.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadProgression(item.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
                      selectedUserId === item.id
                        ? "border-primary/50 bg-primary/10"
                        : "border-border/50 hover:border-primary/30 hover:bg-secondary/30"
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{item.name || "Sem nome"}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.email || item.id}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 overflow-y-auto min-h-[240px]">
            {!selectedUserId && (
              <p className="text-sm text-muted-foreground">
                Selecione uma conta para visualizar semestres, notas e lembretes.
              </p>
            )}

            {selectedUser && (
              <div className="mb-4">
                <p className="text-sm font-semibold">{selectedUser.name || "Sem nome"}</p>
                <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                {selectedUser.phone && (
                  <p className="text-xs text-muted-foreground">{selectedUser.phone}</p>
                )}
              </div>
            )}

            {loadingProgression && (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            )}

            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive mb-4">
                {error}
              </div>
            )}

            {!loadingProgression && selectedUserId && progression === null && !error && (
              <p className="text-sm text-muted-foreground">Esta conta ainda não possui dados salvos.</p>
            )}

            {progression && (
              <div className="space-y-4">
                {progression.semesters.map((semester) => (
                  <div key={semester.id} className="rounded-xl border border-border/50 p-4 bg-secondary/20">
                    <h3 className="font-semibold text-primary mb-2">{semester.title}</h3>
                    <ul className="space-y-1 text-sm">
                      {semester.disciplines.map((discipline) => (
                        <li key={discipline.id} className="flex items-center gap-2">
                          <span>{discipline.emoji}</span>
                          <span className="flex-1">{discipline.name}</span>
                          <span className="text-muted-foreground">{discipline.grade || "—"}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {progression.reminders.length > 0 && (
                  <div className="rounded-xl border border-border/50 p-4 bg-secondary/20">
                    <h3 className="font-semibold mb-2">Lembretes</h3>
                    <ul className="space-y-1 text-sm">
                      {progression.reminders.map((reminder) => (
                        <li key={reminder.id}>
                          {reminder.date} · {reminder.title || "Sem título"}
                          {reminder.done ? " ✓" : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {progression.notes && (
                  <div className="rounded-xl border border-border/50 p-4 bg-secondary/20">
                    <h3 className="font-semibold mb-2">Anotações</h3>
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{progression.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-border/50 flex justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  )
}
