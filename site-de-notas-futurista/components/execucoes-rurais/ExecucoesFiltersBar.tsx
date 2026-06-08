"use client"

import type { ExecucaoFilters } from "@/lib/execucoes-rurais/types"
import { EXECUCAO_STATUS_LABELS } from "@/lib/execucoes-rurais/types"
import { NATUREZAS_EXECUCAO } from "@/lib/datajud/naturezas"
import { DatajudFilterFields } from "@/components/datajud/DatajudFilterFields"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  filters: ExecucaoFilters
  onChange: (filters: ExecucaoFilters) => void
}

export function ExecucoesFiltersBar({ filters, onChange }: Props) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <DatajudFilterFields
        filters={filters}
        onChange={onChange}
        naturezas={NATUREZAS_EXECUCAO}
      />
      <div className="space-y-1.5">
        <Label>Comarca</Label>
        <Input
          value={filters.comarca}
          onChange={(e) => onChange({ ...filters, comarca: e.target.value })}
          placeholder="Ex.: Presidente Prudente"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Valor mín.</Label>
        <Input
          type="number"
          value={filters.valorMin}
          onChange={(e) => onChange({ ...filters, valorMin: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Valor máx.</Label>
        <Input
          type="number"
          value={filters.valorMax}
          onChange={(e) => onChange({ ...filters, valorMax: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) =>
            onChange({ ...filters, status: e.target.value as ExecucaoFilters["status"] })
          }
        >
          <option value="all">Todos</option>
          {Object.entries(EXECUCAO_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
