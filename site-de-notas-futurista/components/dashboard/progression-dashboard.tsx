"use client"

import { signOut } from "firebase/auth"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import {
  Cloud,
  Eye,
  GripVertical,
  LogOut,
  Moon,
  Plus,
  Scale,
  Search,
  Sun,
  X,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { useAdminImpersonation } from "@/components/admin-impersonation-provider"
import { useTheme } from "@/components/theme-provider"
import { InstagramIcon, WhatsAppIcon } from "@/components/social-icons"
import { Button } from "@/components/ui/button"
import { RemindersSection } from "@/components/dashboard/reminders-section"
import { SemesterCard } from "@/components/dashboard/semester-card"
import { HeaderTutorialButtons } from "@/components/dashboard/header-tutorial-buttons"
import { DashboardOnboardingTour } from "@/components/dashboard/dashboard-onboarding-tour"
import { AdminPanelDrawer } from "@/components/dashboard/admin-panel-drawer"
import { SiteAdSlot } from "@/components/site-ad-slot"
import { useExtendedScope } from "@/components/use-extended-scope"
import { hasExtendedScope } from "@/lib/admin-access"
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
import { SiteFooter } from "@/components/site-footer"
import { processDueReminders } from "@/lib/reminder-notifications"

export function ProgressionDashboard({ tourEnabled = false }: { tourEnabled?: boolean }) {
  const { user } = useAuth()
  const { impersonation, stopImpersonation, hydrated: impersonationReady } = useAdminImpersonation()
  const canUseScope = useExtendedScope()
  const adminAccess = hasExtendedScope(user?.email) || canUseScope
  const effectiveUserId = impersonation?.userId ?? user?.uid
  const isViewingAsUser = Boolean(impersonation)
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
  const [adminTab, setAdminTab] = useState<"users" | "ads">("users")
  const scopeClickCount = useRef(0)
  const scopeClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipSave = useRef(true)

  useEffect(() => {
    if (!effectiveUserId) return

    skipSave.current = true
    setReady(false)
    setLoading(true)

    const unsub = subscribeProgression(
      effectiveUserId,
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
  }, [effectiveUserId])

  const persist = useCallback(
    (next: ProgressionData) => {
      if (!effectiveUserId || skipSave.current) return
      setSaving(true)
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        try {
          await saveProgression(effectiveUserId, next)
        } finally {
          setSaving(false)
        }
      }, 600)
    },
    [effectiveUserId]
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

  const handleLogoClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault()

      const isAdmin = hasExtendedScope(user?.email) || canUseScope

      if (!isAdmin) {
        window.open("https://fipecafi.org/", "_blank", "noopener,noreferrer")
        return
      }

      scopeClickCount.current += 1

      if (scopeClickTimer.current) clearTimeout(scopeClickTimer.current)

      if (scopeClickCount.current >= 3) {
        scopeClickCount.current = 0
        if (scopeClickTimer.current) clearTimeout(scopeClickTimer.current)
        setAdminTab("users")
        setAdminOpen(true)
        return
      }

      scopeClickTimer.current = setTimeout(() => {
        const clicks = scopeClickCount.current
        scopeClickCount.current = 0
        if (clicks >= 1 && clicks < 3) {
          window.open("https://fipecafi.org/", "_blank", "noopener,noreferrer")
        }
      }, 800)
    },
    [canUseScope, user?.email]
  )

  useEffect(() => {
    if (!user || !ready || data.reminders.length === 0 || isViewingAsUser) return

    let cancelled = false

    processDueReminders(user.uid, data.reminders)
      .then((updated) => {
        if (cancelled) return
        const changed = updated.some(
          (item, index) => item.notifiedOn !== data.reminders[index]?.notifiedOn
        )
        if (changed) {
          updateData((prev) => ({ ...prev, reminders: updated }))
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [user, ready, data.reminders, updateData, isViewingAsUser])

  const filteredCount = data.semesters.filter((s) => semesterMatchesSearch(s, searchQuery)).length

  if (loading || !impersonationReady) {
    return (
      <div className="min-h-screen flex items-center justify-center grid-pattern">
        <p className="text-muted-foreground">Carregando seu painel...</p>
      </div>
    )
  }

  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden pb-24 max-md:pb-32">
      {isViewingAsUser && impersonation && (
        <div className="sticky top-0 z-[350] bg-primary text-primary-foreground px-4 py-2.5 shadow-md">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Eye className="w-4 h-4 shrink-0" />
              Visualizando como{" "}
              <strong>{impersonation.name || impersonation.email || "usuário"}</strong>
              {impersonation.email && impersonation.name ? (
                <span className="opacity-80 font-normal">({impersonation.email})</span>
              ) : null}
            </p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={stopImpersonation}
              className="shrink-0 h-8 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25 border-0"
            >
              <X className="w-4 h-4 mr-1.5" />
              Voltar ao meu painel
            </Button>
          </div>
        </div>
      )}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      {saving && (
        <div className="fixed bottom-6 left-6 z-50 flex items-center gap-2 text-xs bg-background/90 border border-border px-4 py-2 rounded-full neon-border max-md:bottom-20 max-md:left-1/2 max-md:-translate-x-1/2 max-md:whitespace-nowrap">
          <Cloud className="w-3.5 h-3.5 text-primary animate-pulse" />
          Salvando na nuvem...
        </div>
      )}

      <header className="relative z-10 border-b border-border/50 glass-card">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
            <div className="flex-1 min-w-0 order-2 lg:order-1">
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <div className="glass-card neon-border rounded-xl px-4 py-2 flex items-center gap-3 max-md:flex-wrap max-md:gap-2">
                  <a
                    href="https://fipecafi.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={handleLogoClick}
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
                  <span className="text-sm font-bold text-primary border-l border-primary/30 pl-3 max-md:border-l-0 max-md:pl-0 max-md:w-full max-md:text-xs">
                    Gestão de Progressão
                  </span>
                </div>
              </div>

              <HeaderTutorialButtons />
            </div>

            <div className="flex flex-col items-end justify-between gap-4 shrink-0 order-1 lg:order-2 lg:self-stretch lg:min-h-full max-md:items-stretch max-md:w-full">
              <div className="flex flex-col items-end gap-2 max-md:items-stretch" data-tour="contact">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground max-md:text-xs">
                  Dúvidas ou contato?
                </span>
                <div className="flex flex-wrap items-center justify-end gap-2 max-md:justify-start">
                  <a
                    href="https://wa.me/5518997012718"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-[#25D366]/50 transition-colors flex items-center gap-1.5 max-md:min-h-11 max-md:px-4 max-md:text-sm"
                  >
                    <WhatsAppIcon className="w-4 h-4 text-[#25D366]" />
                    WhatsApp
                  </a>
                  <a
                    href="https://www.instagram.com/advforte/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-secondary/60 border border-border hover:border-[#E4405F]/50 transition-colors flex items-center gap-1.5 max-md:min-h-11 max-md:px-4 max-md:text-sm"
                  >
                    <InstagramIcon className="w-4 h-4 text-[#E4405F]" />
                    @advforte
                  </a>
                </div>
                <div className="flex items-center justify-end gap-1 sm:gap-2 max-md:justify-between max-md:w-full">
                  <button
                    type="button"
                    onClick={() => setTourRestartKey((key) => key + 1)}
                    className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground hover:text-primary transition-colors px-2 py-1 max-md:text-xs max-md:min-h-11 max-md:px-3"
                  >
                    Ver guia da página
                  </button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleTheme}
                    className="text-muted-foreground h-8 px-2 max-md:h-11 max-md:w-11 max-md:px-0"
                    title={theme === "light" ? "Modo escuro" : "Modo claro"}
                  >
                    {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                  </Button>
                </div>
              </div>

              {adminAccess && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="shrink-0 max-md:w-full max-md:min-h-11"
                  title="Licitações jurídicas (acesso privado)"
                >
                  <Link href="/dashboard/licitacoes/">
                    <Scale className="w-4 h-4 mr-2" />
                    Licitações
                  </Link>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="shrink-0 text-muted-foreground border-border/60 hover:text-foreground max-md:w-full max-md:min-h-11"
                title="Sair da conta"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold gradient-text mb-2">
            {isViewingAsUser ? "Percurso Acadêmico do Usuário" : "Meu Percurso Acadêmico"}
          </h1>
          <p className="text-muted-foreground">
            {isViewingAsUser
              ? "Painel completo deste usuário — alterações são salvas na conta dele."
              : "Organize suas disciplinas, notas e prioridades estratégicas."}
          </p>
        </div>

        <SiteAdSlot placement="dashboard" className="mb-8" />

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

        <div className="glass-card rounded-xl px-5 py-4 mb-8 flex flex-wrap gap-x-6 gap-y-2 text-sm neon-border max-md:px-4 max-md:gap-y-3" data-tour="legend">
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
          className="glass-card-gold rounded-2xl p-6 neon-border-gold border-l-4 border-l-accent max-md:p-4"
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

      {adminAccess && (
        <AdminPanelDrawer
          open={adminOpen}
          initialTab={adminTab}
          onClose={() => setAdminOpen(false)}
        />
      )}
    </main>
  )
}
