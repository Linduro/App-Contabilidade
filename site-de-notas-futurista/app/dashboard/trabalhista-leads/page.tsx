"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Radar, RefreshCw } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { useTrabalhistaLeadsDashboard } from "@/hooks/use-trabalhista-leads-dashboard"
import { TrabalhistaSidebar } from "@/components/trabalhista-leads/TrabalhistaSidebar"
import { LeadFiltersBar } from "@/components/trabalhista-leads/LeadFiltersBar"
import { LeadsKanban } from "@/components/trabalhista-leads/LeadsKanban"
import { LeadsTable } from "@/components/trabalhista-leads/LeadsTable"
import { LeadDetailModal } from "@/components/trabalhista-leads/LeadDetailModal"
import { Button } from "@/components/ui/button"
import type { Lead } from "@/lib/trabalhista-leads/types"

function TrabalhistaLeadsContent() {
  const {
    filteredLeads,
    stats,
    filters,
    setFilters,
    loading,
    collecting,
    collectMessage,
    error,
    changeStatus,
    collectNow,
    reload,
    regionalFilters,
    setRegionalFilters,
  } = useTrabalhistaLeadsDashboard(true)

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const handleSelect = (lead: Lead) => {
    setSelectedLead(lead)
    setDetailOpen(true)
  }

  return (
    <div className="flex min-h-screen bg-background">
      <TrabalhistaSidebar
        stats={stats}
        regionalFilters={regionalFilters}
        onRegionalFiltersChange={setRegionalFilters}
      />

      <main className="flex-1 overflow-auto">
        <div className="border-b bg-card px-6 py-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Leads Trabalhistas
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Datajud (CNJ) — réu PJ sem advogado constituído
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                {collecting ? "Buscando…" : "Buscar agora"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => reload()}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6 p-6 lg:p-8">
          {collectMessage && !error && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
              {collectMessage}
            </div>
          )}

          <LeadFiltersBar filters={filters} onChange={setFilters} />

          {loading ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              Carregando leads…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
              {error}
            </div>
          ) : (
            <>
              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Kanban
                </h2>
                <LeadsKanban
                  leads={filteredLeads}
                  onStatusChange={changeStatus}
                  onSelect={handleSelect}
                />
              </section>

              <section>
                <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Tabela
                </h2>
                <LeadsTable leads={filteredLeads} onSelect={handleSelect} />
              </section>
            </>
          )}
        </div>
      </main>

      <LeadDetailModal
        lead={selectedLead}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  )
}

export default function TrabalhistaLeadsPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <TrabalhistaLeadsContent />
      </RequireOwner>
    </RequireAuth>
  )
}
