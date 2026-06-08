"use client"

import type { LeadFilters } from "@/lib/trabalhista-leads/types"
import { LEAD_STATUS_LABELS } from "@/lib/trabalhista-leads/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface LeadFiltersBarProps {
  filters: LeadFilters
  onChange: (filters: LeadFilters) => void
}

export function LeadFiltersBar({ filters, onChange }: LeadFiltersBarProps) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5">
        <Label htmlFor="filtro-comarca">Comarca / Vara</Label>
        <Input
          id="filtro-comarca"
          placeholder="Ex.: Campinas"
          value={filters.comarca}
          onChange={(e) => onChange({ ...filters, comarca: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-valor-min">Valor mín. (R$)</Label>
        <Input
          id="filtro-valor-min"
          type="number"
          min={0}
          placeholder="0"
          value={filters.valorMin}
          onChange={(e) => onChange({ ...filters, valorMin: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-valor-max">Valor máx. (R$)</Label>
        <Input
          id="filtro-valor-max"
          type="number"
          min={0}
          placeholder="999999"
          value={filters.valorMax}
          onChange={(e) => onChange({ ...filters, valorMax: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-status">Status</Label>
        <select
          id="filtro-status"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.status}
          onChange={(e) =>
            onChange({
              ...filters,
              status: e.target.value as LeadFilters["status"],
            })
          }
        >
          <option value="all">Todos</option>
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
