"use client"

import type { TrabalhistaStats } from "@/lib/trabalhista-leads/types"
import { RegionalFilterPanel } from "@/components/regional-filters/RegionalFilterPanel"
import type { RegionalFilterState } from "@/lib/regional-filters/regioes"

interface TrabalhistaSidebarProps {
  stats: TrabalhistaStats
  regionalFilters: RegionalFilterState
  onRegionalFiltersChange: (filters: RegionalFilterState) => void
}

export function TrabalhistaSidebar({
  stats,
  regionalFilters,
  onRegionalFiltersChange,
}: TrabalhistaSidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/30 p-6 lg:block">
      <h2 className="text-lg font-semibold">Leads TRT</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Justiça do Trabalho — sem advogado
      </p>
      <dl className="mt-8 space-y-4 text-sm">
        <Stat label="Total" value={stats.total} />
        <Stat label="Novos" value={stats.novos} />
        <Stat label="Contatados" value={stats.contatados} />
        <Stat label="Respondeu" value={stats.respondeu} />
        <Stat label="Clientes" value={stats.clientes} />
        <Stat label="Score médio" value={stats.scoreMedio} />
      </dl>
      <RegionalFilterPanel
        filters={regionalFilters}
        onChange={onRegionalFiltersChange}
      />

      <p className="mt-6 text-xs text-muted-foreground leading-relaxed">
        Worker na nuvem (GitHub Actions) lê a config em Firestore e executa
        coleta Datajud + disparos. Nada roda no seu PC.
      </p>
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  )
}
