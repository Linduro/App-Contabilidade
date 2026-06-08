"use client"

import Link from "next/link"
import { ArrowLeft, Loader2, Radar, RefreshCw } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { useExecucoesRuraisDashboard } from "@/hooks/use-execucoes-rurais-dashboard"
import { ExecucoesSidebar } from "@/components/execucoes-rurais/ExecucoesSidebar"
import { ExecucoesCards } from "@/components/execucoes-rurais/ExecucoesCards"
import { ExecucoesFiltersBar } from "@/components/execucoes-rurais/ExecucoesFiltersBar"
import { Button } from "@/components/ui/button"

function Content() {
  const {
    items,
    filters,
    setFilters,
    regionalFilters,
    setRegionalFilters,
    loading,
    collecting,
    collectMessage,
    error,
    reload,
    collectNow,
    changeStatus,
  } = useExecucoesRuraisDashboard(true)

  return (
    <div className="flex min-h-screen bg-background">
      <ExecucoesSidebar
        total={items.length}
        regionalFilters={regionalFilters}
        onRegionalFiltersChange={setRegionalFilters}
      />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Execuções contra produtores rurais</h1>
            <p className="text-sm text-muted-foreground">
              TJSP / TRF3 — produtor rural sem advogado
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
            <Button variant="outline" size="sm" disabled={loading} onClick={() => reload()}>
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

        {collectMessage && !error && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
            {collectMessage}
          </div>
        )}

        <div className="mb-6">
          <ExecucoesFiltersBar filters={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <ExecucoesCards items={items} onStatusChange={changeStatus} />
        )}
      </main>
    </div>
  )
}

export default function ExecucoesRuraisPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <Content />
      </RequireOwner>
    </RequireAuth>
  )
}
