"use client"

import Link from "next/link"
import { ArrowLeft, Loader2, Radar, RefreshCw } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { useExecucoesAltoValorDashboard } from "@/hooks/use-execucoes-alto-valor-dashboard"
import { AltoValorSidebar } from "@/components/execucoes-alto-valor/AltoValorSidebar"
import { AltoValorFiltersBar } from "@/components/execucoes-alto-valor/AltoValorFiltersBar"
import { AltoValorTable } from "@/components/execucoes-alto-valor/AltoValorTable"
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
  } = useExecucoesAltoValorDashboard(true)

  return (
    <div className="flex min-h-screen bg-background">
      <AltoValorSidebar
        total={items.length}
        regionalFilters={regionalFilters}
        onRegionalFiltersChange={setRegionalFilters}
      />
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Execuções +500k</h1>
            <p className="text-sm text-muted-foreground">
              Execuções acima de R$ 500.000 — executado sem advogado (classes 877, 1116, 40)
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
          <AltoValorFiltersBar filters={filters} onChange={setFilters} />
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando…</p>
        ) : error ? (
          <p className="text-destructive">{error}</p>
        ) : (
          <AltoValorTable items={items} onStatusChange={changeStatus} />
        )}
      </main>
    </div>
  )
}

export default function ExecucoesAltoValorPage() {
  return (
    <RequireAuth>
      <RequireOwner>
        <Content />
      </RequireOwner>
    </RequireAuth>
  )
}
