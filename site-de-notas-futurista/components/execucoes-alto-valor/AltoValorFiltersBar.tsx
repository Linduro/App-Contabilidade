"use client"

import type { AltoValorFilters } from "@/lib/execucoes-alto-valor/types"
import { ALTO_VALOR_STATUS_LABELS } from "@/lib/execucoes-alto-valor/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  filters: AltoValorFilters
  onChange: (filters: AltoValorFilters) => void
}

export function AltoValorFiltersBar({ filters, onChange }: Props) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label>Ajuizamento de</Label>
        <Input
          type="date"
          value={filters.dataDe}
          onChange={(e) => onChange({ ...filters, dataDe: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Ajuizamento até</Label>
        <Input
          type="date"
          value={filters.dataAte}
          onChange={(e) => onChange({ ...filters, dataAte: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Comarca</Label>
        <Input
          value={filters.comarca}
          onChange={(e) => onChange({ ...filters, comarca: e.target.value })}
          placeholder="Filtrar comarca"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as AltoValorFilters["status"] })
          }
        >
          <option value="all">Todos</option>
          {Object.entries(ALTO_VALOR_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
