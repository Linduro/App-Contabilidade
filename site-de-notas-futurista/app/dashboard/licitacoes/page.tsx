"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Radar } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { useLicitacoesDashboard } from "@/hooks/use-licitacoes-dashboard"
import { Sidebar } from "@/components/licitacoes/Sidebar"
import { MatchFiltersBar } from "@/components/licitacoes/MatchFiltersBar"
import { MatchesTable } from "@/components/licitacoes/MatchesTable"
import { MatchDetailModal } from "@/components/licitacoes/MatchDetailModal"
import { Button } from "@/components/ui/button"
import type { Match } from "@/lib/licitacoes/types"

function LicitacoesDashboardContent() {
  const {
    advogadoNome,
    advogadoEmail,
    matches,
    especialidades,
    stats,
    filters,
    setFilters,
    regionalFilters,
    setRegionalFilters,
    loading,
    collecting,
    collectMessage,
    error,
    collectNow,
    updateMatchStatus,
  } = useLicitacoesDashboard(true)

  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const handleSelect = async (match: Match) => {
    setSelectedMatch(match)
    setModalOpen(true)

    if (match.status === "novo") {
      try {
        await updateMatchStatus(match.id, "visto")
        setSelectedMatch({ ...match, status: "visto" })
      } catch {
        // mantém modal aberto
      }
    }
  }

  const handleInscrito = async (matchId: string) => {
    setActionLoading(true)
    try {
      await updateMatchStatus(matchId, "inscrito")
      setSelectedMatch((prev) =>
        prev?.id === matchId ? { ...prev, status: "inscrito" } : prev,
      )
    } finally {
      setActionLoading(false)
    }
  }

  const handleArchive = async (matchId: string) => {
    setActionLoading(true)
    try {
      await updateMatchStatus(matchId, "arquivado")
      setModalOpen(false)
      setSelectedMatch(null)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        especialidades={especialidades}
        stats={stats}
        advogadoOverride={{ nome: advogadoNome, email: advogadoEmail }}
        regionalFilters={regionalFilters}
        onRegionalFiltersChange={setRegionalFilters}
      />

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-card px-8 py-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Licitações jurídicas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Fonte PNCP (gov.br) — matches privados
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="default"
                size="sm"
                disabled={collecting || loading}
                onClick={() => collectNow().catch(() => undefined)}
              >
                {collecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Radar className="mr-2 h-4 w-4" />
                )}
                {collecting ? "Caçando…" : "Caçar agora"}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/area-restrita/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar ao painel
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-8">
          {collectMessage && !error && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
              {collectMessage}
            </div>
          )}

          <MatchFiltersBar
            filters={filters}
            onChange={setFilters}
            especialidades={especialidades}
          />

          {loading ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              Carregando licitações…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <MatchesTable
              matches={matches}
              filters={filters}
              onSelect={handleSelect}
            />
          )}
        </div>
      </main>

      <MatchDetailModal
        match={selectedMatch}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onMarkInscrito={handleInscrito}
        onArchive={handleArchive}
        loading={actionLoading}
      />
    </div>
  )
}

export default function LicitacoesDashboardPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <LicitacoesDashboardContent />
      </RequireOwner>
    </RequireAuth>
  )
}
