"use client"

import { RegionalFilterPanel } from "@/components/regional-filters/RegionalFilterPanel"
import type { RegionalFilterState } from "@/lib/regional-filters/regioes"

interface Props {
  total: number
  regionalFilters: RegionalFilterState
  onRegionalFiltersChange: (f: RegionalFilterState) => void
}

export function ExecucoesSidebar({ total, regionalFilters, onRegionalFiltersChange }: Props) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-card/30 p-6 lg:block">
      <h2 className="text-lg font-semibold">Execuções Rurais</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Produtores sem advogado — TJSP / TRF3
      </p>
      <p className="mt-6 text-2xl font-bold tabular-nums">{total}</p>
      <p className="text-xs text-muted-foreground">leads ativos</p>

      <div className="mt-8">
        <RegionalFilterPanel filters={regionalFilters} onChange={onRegionalFiltersChange} />
      </div>
    </aside>
  )
}
