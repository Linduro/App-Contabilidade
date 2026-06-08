"use client"

import Link from "next/link"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { RequireAuth } from "@/components/require-auth"
import { RequireOwner } from "@/components/require-owner"
import { useExecucoesRuraisDashboard } from "@/hooks/use-execucoes-rurais-dashboard"
import { ExecucoesSidebar } from "@/components/execucoes-rurais/ExecucoesSidebar"
import { ExecucoesCards } from "@/components/execucoes-rurais/ExecucoesCards"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

function Content() {
  const {
    items,
    filters,
    setFilters,
    regionalFilters,
    setRegionalFilters,
    loading,
    error,
    reload,
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
              Crédito rural / penhora — filtros independentes dos outros módulos
            </p>
          </div>
          <div className="flex gap-2">
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

        <div className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-3">
          <div>
            <Label>Comarca</Label>
            <Input
              value={filters.comarca}
              onChange={(e) => setFilters({ ...filters, comarca: e.target.value })}
            />
          </div>
          <div>
            <Label>Valor mín.</Label>
            <Input
              type="number"
              value={filters.valorMin}
              onChange={(e) => setFilters({ ...filters, valorMin: e.target.value })}
            />
          </div>
          <div>
            <Label>Valor máx.</Label>
            <Input
              type="number"
              value={filters.valorMax}
              onChange={(e) => setFilters({ ...filters, valorMax: e.target.value })}
            />
          </div>
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
