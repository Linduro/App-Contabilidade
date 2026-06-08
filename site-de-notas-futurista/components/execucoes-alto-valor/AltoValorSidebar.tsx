"use client"

import { RegionalFilterPanel } from "@/components/regional-filters/RegionalFilterPanel"
import type { RegionalFilterState } from "@/lib/regional-filters/regioes"

interface Props {
  total: number
  regionalFilters: RegionalFilterState
  onRegionalFiltersChange: (filters: RegionalFilterState) => void
}

export function AltoValorSidebar({
  total,
  regionalFilters,
  onRegionalFiltersChange,
}: Props) {
  return (
    <aside className="hidden w-72 shrink-0 border-r bg-card p-4 lg:block">
      <h2 className="text-sm font-semibold">Execuções +500k</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        {total} processo(s) — executado sem advogado
      </p>
      <div className="mt-6">
        <RegionalFilterPanel
          filters={regionalFilters}
          onChange={onRegionalFiltersChange}
        />
      </div>
    </aside>
  )
}
