"use client"

import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Cloud,
  ExternalLink,
  GripVertical,
  LogOut,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import {
  createDiscipline,
  createSemester,
  defaultProgression,
  DISCIPLINE_PRESETS,
  type Discipline,
  type DisciplineStatus,
  type DisciplineType,
  type ProgressionData,
  PORTAL_LINKS,
  saveProgression,
  subscribeProgression,
} from "@/lib/progression-data"

function DisciplineRow({
  discipline,
  onChange,
  onDelete,
}: {
  discipline: Discipline
  onChange: (updated: Discipline) => void
  onDelete: () => void
}) {
  const isDiscarded = discipline.type === "discarded"
  const isCursando = discipline.status === "cursando"
  const isConcluido = discipline.status === "concluido"

  const setStatus = (status: DisciplineStatus) => {
    if (discipline.status === status) {
      onChange({ ...discipline, status: "none" })
      return
    }
    onChange({ ...discipline, status })
  }

  return (
    <li
      className={`flex items-center justify-between gap-3 px-5 py-3 border-b border-border/50 last:border-b-0 ${
        isCursando ? "bg-accent/5" : isConcluido ? "bg-primary/5" : ""
      }`}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <GripVertical className="w-4 h-4 text-muted-foreground/40 shrink-0" />
        <input
          value={discipline.emoji}
          onChange={(e) => onChange({ ...discipline, emoji: e.target.value })}
          className="w-12 text-center bg-transparent border-none outline-none text-lg shrink-0"
          aria-label="Prioridade"
        />
        <input
          value={discipline.name}
          onChange={(e) => onChange({ ...discipline, name: e.target.value })}
          className={`flex-1 min-w-0 bg-transparent border-none outline-none font-medium text-sm focus:ring-1 focus:ring-primary/40 rounded px-1 ${
            isDiscarded ? "line-through text-muted-foreground" : ""
          }`}
        />
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setStatus("cursando")}
          className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-md border transition-all ${
            isCursando
              ? "bg-accent/20 border-accent text-accent"
              : "bg-secondary/50 border-border text-muted-foreground hover:border-accent/50"
          }`}
        >
          Cursando
        </button>
        <button
          type="button"
          onClick={() => setStatus("concluido")}
          className={`text-[10px] font-bold uppercase px-2.5 py-1.5 rounded-md border transition-all ${
            isConcluido
              ? "bg-primary/20 border-primary text-primary"
              : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
          }`}
        >
          Concluído
        </button>
        <input
          type="number"
          step="0.1"
          placeholder="0.0"
          value={discipline.grade}
          onChange={(e) => onChange({ ...discipline, grade: e.target.value })}
          className="w-14 h-8 px-1 bg-secondary/50 border border-border rounded-md text-center font-bold text-sm"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  )
}

function SemesterCard({
  semester,
  onChange,
  onDelete,
}: {
  semester: { id: string; title: string; disciplines: Discipline[] }
  onChange: (updated: typeof semester) => void
  onDelete: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("click", close)
    return () => document.removeEventListener("click", close)
  }, [menuOpen])

  const addDiscipline = (type: DisciplineType) => {
    onChange({
      ...semester,
      disciplines: [...semester.disciplines, createDiscipline(type)],
    })
    setMenuOpen(false)
  }

  const updateDiscipline = (index: number, updated: Discipline) => {
    const disciplines = [...semester.disciplines]
    disciplines[index] = updated
    onChange({ ...semester, disciplines })
  }

  const deleteDiscipline = (index: number) => {
    onChange({
      ...semester,
      disciplines: semester.disciplines.filter((_, i) => i !== index),
    })
  }

  return (
    <section className="glass-card rounded-2xl neon-border overflow-hidden mb-6">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 border-t-4 border-t-primary">
        <input
          value={semester.title}
          onChange={(e) => onChange({ ...semester, title: e.target.value })}
          className="bg-transparent border-none outline-none text-lg font-bold text-primary focus:ring-1 focus:ring-primary/40 rounded px-1"
        />
        <button
          type="button"
          onClick={onDelete}
          className="p-2 text-muted-foreground hover:text-destructive rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="divide-y divide-border/30">
        {semester.disciplines.map((d, i) => (
          <DisciplineRow
            key={d.id}
            discipline={d}
            onChange={(updated) => updateDiscipline(i, updated)}
            onDelete={() => deleteDiscipline(i)}
          />
        ))}
      </ul>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="w-full py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/30 border-t border-dashed border-border/50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Adicionar Disciplina
        </button>
        {menuOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 glass-card rounded-xl neon-border py-1 min-w-[200px] z-20">
            {(Object.keys(DISCIPLINE_PRESETS) as DisciplineType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => addDiscipline(type)}
                className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-primary/10 hover:text-primary flex items-center gap-2"
              >
                <span>{DISCIPLINE_PRESETS[type].emoji}</span>
                {DISCIPLINE_PRESETS[type].label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export function ProgressionDashboard() {
  const { user } = useAuth()
  const router = useRouter()
  const [data, setData] = useState<ProgressionData>(defaultProgression())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = useRef(true)
  const logoInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    const unsub = subscribeProgression(
      user.uid,
      (remote) => {
        setData(remote.semesters.length ? remote : defaultProgression())
        setLoading(false)
        setTimeout(() => {
          skipSave.current = false
          setReady(true)
        }, 100)
      },
      () => setLoading(false)
    )
    return unsub
  }, [user])

  const persist = useCallback(
    (next: ProgressionData) => {
      if (!user || skipSave.current) return
      setSaving(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await saveProgression(user.uid, next)
        } finally {
          setSaving(false)
        }
      }, 600)
    },
    [user]
  )

  const updateData = useCallback(
    (updater: (prev: ProgressionData) => ProgressionData) => {
      setData((prev) => {
        const next = updater(prev)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const handleSignOut = async () => {
    await signOut(auth)
    router.push("/")
  }

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const logoData = e.target?.result as string
      updateData((prev) => ({ ...prev, logoData }))
    }
    reader.readAsDataURL(file)
  }

  const handleExport = () => {
    const blob = new Blob(
      [
        `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>Painel FIPECAFI Export</title></head><body>` +
          `<h1>Meu Percurso Acadêmico</h1>` +
          data.semesters
            .map(
              (s) =>
                `<h2>${s.title}</h2><ul>` +
                s.disciplines
                  .map(
                    (d) =>
                      `<li>${d.emoji} ${d.name} — ${d.status}${d.grade ? ` (${d.grade})` : ""}</li>`
                  )
                  .join("") +
                `</ul>`
            )
            .join("") +
          `<h3>Anotações</h3><p>${data.notes}</p></body></html>`,
      ],
      { type: "text/html" }
    )
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = "Painel_FIPECAFI_Export.html"
    a.click()
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-pattern">
        <p className="text-muted-foreground">Carregando seu painel...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden pb-24">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {saving && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 text-xs bg-background/90 border border-border px-4 py-2 rounded-full neon-border">
          <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
          Salvando na nuvem...
        </div>
      )}

      <header className="relative z-10 border-b border-border/50 glass-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    data.logoData
                      ? window.open("https://fipecafi.org/", "_blank")
                      : logoInputRef.current?.click()
                  }
                  className="glass-card-gold neon-border-gold rounded-xl px-4 py-2 flex items-center gap-3 hover:scale-[1.02] transition-transform"
                >
                  {data.logoData ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.logoData} alt="Logo" className="h-9 w-auto" />
                  ) : (
                    <Sparkles className="w-6 h-6 text-accent" />
                  )}
                  <span className="text-sm font-bold text-accent border-l border-accent/30 pl-3">
                    Gestão de Progressão
                  </span>
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {PORTAL_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-secondary/60 border border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors flex items-center gap-1"
                  >
                    {link.label}
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                ))}
              </div>
            </div>

            <div className="flex flex-col items-start lg:items-end gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Dúvidas ou contato?
              </span>
              <div className="flex flex-wrap gap-2">
                <a
                  href="https://wa.me/5518997012718"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                >
                  WhatsApp
                </a>
                <a
                  href="https://www.instagram.com/advforte/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-primary/40 transition-colors"
                >
                  @advforte
                </a>
                <span className="text-xs text-muted-foreground hidden sm:inline self-center">
                  {user?.displayName || user?.email}
                </span>
                <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                  <LogOut className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">Meu Percurso Acadêmico</h1>
          <p className="text-muted-foreground">
            Organize suas disciplinas, notas e prioridades estratégicas.
          </p>
        </div>

        <div className="glass-card rounded-xl px-5 py-4 mb-8 flex flex-wrap gap-6 text-sm neon-border">
          <span className="flex items-center gap-2 font-medium">
            <span>🔥🔥</span> Essenciais
          </span>
          <span className="flex items-center gap-2 font-medium">
            <span>🔥</span> Importantes
          </span>
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <span>🚫</span> Dispensadas / Descartadas
          </span>
        </div>

        {ready &&
          data.semesters.map((semester) => (
            <SemesterCard
              key={semester.id}
              semester={semester}
              onChange={(updated) =>
                updateData((prev) => ({
                  ...prev,
                  semesters: prev.semesters.map((s) => (s.id === semester.id ? updated : s)),
                }))
              }
              onDelete={() =>
                updateData((prev) => ({
                  ...prev,
                  semesters: prev.semesters.filter((s) => s.id !== semester.id),
                }))
              }
            />
          ))}

        <Button
          variant="outline"
          onClick={() =>
            updateData((prev) => ({
              ...prev,
              semesters: [...prev.semesters, createSemester()],
            }))
          }
          className="w-full sm:w-auto flex border-dashed border-primary/50 text-primary hover:bg-primary/10 mb-10"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Novo Semestre
        </Button>

        <section className="glass-card-gold rounded-2xl p-6 neon-border-gold border-l-4 border-l-accent">
          <h3 className="text-lg font-bold text-accent mb-4">Anotações</h3>
          <textarea
            value={data.notes}
            onChange={(e) => updateData((prev) => ({ ...prev, notes: e.target.value }))}
            rows={5}
            className="w-full bg-secondary/30 border border-border/50 rounded-xl px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="Anote aqui suas observações."
          />
          <p className="mt-5 pt-4 border-t border-border/30 text-sm italic text-muted-foreground">
            &ldquo;Pregue o evangelho o tempo todo, se necessário use palavras&rdquo; — São Francisco de Assis.
          </p>
        </section>
      </div>

      <footer className="relative z-10 border-t border-border/50 py-8 px-6 text-center">
        <p className="text-xs text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Feito de aluno para aluno — esta não é uma página oficial da faculdade. Para garantir a
          autenticidade, entre em contato pelos canais no topo. Feito com carinho por Vinícius
          Nascimento.
        </p>
      </footer>

      <button
        type="button"
        onClick={handleExport}
        className="fixed bottom-6 right-6 z-50 bg-accent hover:bg-accent/90 text-accent-foreground font-bold px-5 py-3 rounded-xl neon-border-gold shadow-lg transition-transform hover:scale-105"
      >
        Exportar HTML
      </button>
    </main>
  )
}
