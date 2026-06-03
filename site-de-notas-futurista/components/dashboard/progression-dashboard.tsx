"use client"

import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Cloud,
  GripVertical,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { useTheme } from "@/components/theme-provider"
import { InstagramIcon, WhatsAppIcon } from "@/components/social-icons"
import { Button } from "@/components/ui/button"
import { RemindersSection } from "@/components/dashboard/reminders-section"
import { SemesterCard } from "@/components/dashboard/semester-card"
import { HeaderTutorialButtons } from "@/components/dashboard/header-tutorial-buttons"
import { DashboardOnboardingTour } from "@/components/dashboard/dashboard-onboarding-tour"
import { HiddenAdminPanel } from "@/components/dashboard/hidden-admin-panel"
import { DisciplineEmoji } from "@/components/discipline-emoji"
import {
  createSemester,
  defaultProgression,
  type ProgressionData,
  saveProgression,
  subscribeProgression,
} from "@/lib/progression-data"
import { semesterMatchesSearch } from "@/lib/progression-utils"
import { assetPath } from "@/lib/base-path"
import { isAdminEmail } from "@/lib/admin-access"
import { SiteFooter } from "@/components/site-footer"

export function ProgressionDashboard({ tourEnabled = false }: { tourEnabled?: boolean }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const router = useRouter()
  const [data, setData] = useState<ProgressionData>(defaultProgression())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ready, setReady] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [draggedSemesterIndex, setDraggedSemesterIndex] = useState<number | null>(null)
  const [dragOverSemesterIndex, setDragOverSemesterIndex] = useState<number | null>(null)
  const [tourRestartKey, setTourRestartKey] = useState(0)
  const [adminOpen, setAdminOpen] = useState(false)
  const adminClickCount = useRef(0)
  const adminClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = useRef(true)

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

  const moveSemester = (from: number, to: number) => {
    if (to < 0 || to >= data.semesters.length || from === to) return
    updateData((prev) => {
      const semesters = [...prev.semesters]
      const [moved] = semesters.splice(from, 1)
      semesters.splice(to, 0, moved)
      return { ...prev, semesters }
    })
  }

  const handleSemesterDrop = (targetIndex: number) => {
    if (draggedSemesterIndex !== null) moveSemester(draggedSemesterIndex, targetIndex)
    setDraggedSemesterIndex(null)
    setDragOverSemesterIndex(null)
  }

  const deleteSemester = (id: string) => {
    if (!window.confirm("Excluir este semestre e todas as disciplinas?")) return
    updateData((prev) => ({
      ...prev,
      semesters: prev.semesters.filter((s) => s.id !== id),
    }))
  }

  const handleAdminLogoClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      if (!isAdminEmail(user?.email)) return

      e.preventDefault()
      adminClickCount.current += 1

      if (adminClickTimer.current) clearTimeout(adminClickTimer.current)

      if (adminClickCount.current >= 3) {
        adminClickCount.current = 0
        setAdminOpen(true)
        return
      }

      adminClickTimer.current = setTimeout(() => {
        const clicks = adminClickCount.current
        adminClickCount.current = 0
        if (clicks === 1) {
          window.open("https://fipecafi.org/", "_blank", "noopener,noreferrer")
        }
      }, 500)
    },
    [user?.email]
  )

  const filteredCount = data.semesters.filter((s) => semesterMatchesSearch(s, searchQuery)).length

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
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3 py-2.5 border-b border-border/30">
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                type="button"
                onClick={() => setTourRestartKey((key) => key + 1)}
                className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-primary transition-colors px-2 py-1"
              >
                Ver guia da página
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                className="text-muted-foreground"
                title={theme === "light" ? "Modo escuro" : "Modo claro"}
              >
                {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col items-end gap-1.5 ml-auto" data-tour="contact">
              <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Dúvidas ou contato?
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <a
                  href="https://wa.me/5518997012718"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-[#25D366]/50 transition-colors flex items-center gap-1.5"
                >
                  <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                  WhatsApp
                </a>
                <a
                  href="https://www.instagram.com/advforte/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-[#E4405F]/50 transition-colors flex items-center gap-1.5"
                >
                  <InstagramIcon className="w-4 h-4 text-[#E4405F]" />
                  @advforte
                </a>
              </div>
            </div>
          </div>

          <div className="py-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="glass-card neon-border rounded-xl px-4 py-2 flex items-center gap-3">
                <a
                  href="https://fipecafi.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleAdminLogoClick}
                  className="shrink-0 hover:opacity-80 transition-opacity"
                  title="FIPECAFI"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetPath("/fipecafi-logo-dark.svg")}
                    alt="FIPECAFI"
                    className="h-9 w-auto dark:hidden"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetPath("/fipecafi-logo.svg")}
                    alt="FIPECAFI"
                    className="h-9 w-auto hidden dark:block"
                  />
                </a>
                <span className="text-sm font-bold text-primary border-l border-primary/30 pl-3">
                  Gestão de Progressão
                </span>
              </div>
            </div>

            <HeaderTutorialButtons />
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

        <div className="relative mb-6" data-tour="search">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar disciplina ou semestre..."
            className="w-full h-12 pl-11 pr-4 bg-secondary/40 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="glass-card rounded-xl px-5 py-4 mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm neon-border" data-tour="legend">
          <span className="flex items-center gap-2 font-medium">
            <DisciplineEmoji type="essential" className="text-base" /> Essenciais
          </span>
          <span className="flex items-center gap-2 font-medium">
            <DisciplineEmoji type="important" className="text-base" /> Importantes
          </span>
          <span className="flex items-center gap-2 font-medium">
            <DisciplineEmoji type="neutral" className="text-base" /> Neutras
          </span>
          <span className="flex items-center gap-2 font-medium text-muted-foreground">
            <DisciplineEmoji type="discarded" className="text-base" /> Dispensadas
          </span>
          <span className="flex items-center gap-2 font-medium text-primary/80 w-full sm:w-auto sm:ml-auto">
            <GripVertical className="w-4 h-4" />
            Arraste ☰ para reordenar
          </span>
        </div>

        {searchQuery.trim() && filteredCount === 0 && (
          <p className="text-center text-muted-foreground py-8">Nenhum resultado para &ldquo;{searchQuery}&rdquo;</p>
        )}

        {ready &&
          data.semesters.map((semester, index) => (
            <div key={semester.id} data-tour={index === 0 ? "semesters" : undefined}>
              <SemesterCard
                semester={semester}
                semesterIndex={index}
                totalSemesters={data.semesters.length}
                searchQuery={searchQuery}
                isDragging={draggedSemesterIndex === index}
                isDragOver={dragOverSemesterIndex === index && draggedSemesterIndex !== index}
                onChange={(updated) =>
                  updateData((prev) => ({
                    ...prev,
                    semesters: prev.semesters.map((s) => (s.id === semester.id ? updated : s)),
                  }))
                }
                onDelete={() => deleteSemester(semester.id)}
                onMoveSemester={moveSemester}
                onSemesterDragStart={setDraggedSemesterIndex}
                onSemesterDragOver={setDragOverSemesterIndex}
                onSemesterDrop={handleSemesterDrop}
                onSemesterDragEnd={() => {
                  setDraggedSemesterIndex(null)
                  setDragOverSemesterIndex(null)
                }}
              />
            </div>
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
          data-tour="add-semester"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar Novo Semestre
        </Button>

        <RemindersSection
          reminders={data.reminders}
          onChange={(reminders) => updateData((prev) => ({ ...prev, reminders }))}
        />

        <section
          className="glass-card-gold rounded-2xl p-6 neon-border-gold border-l-4 border-l-accent"
          data-tour="notes"
        >
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

      <SiteFooter />

      {ready && (
        <DashboardOnboardingTour autoStart={tourEnabled} restartKey={tourRestartKey} />
      )}

      {isAdminEmail(user?.email) && (
        <HiddenAdminPanel open={adminOpen} onClose={() => setAdminOpen(false)} />
      )}
    </main>
  )
}
