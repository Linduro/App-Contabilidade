"use client"

import type { AltoValorFilters } from "@/lib/execucoes-alto-valor/types"
import { ALTO_VALOR_STATUS_LABELS } from "@/lib/execucoes-alto-valor/types"
import { CaptacaoFilterField } from "@/components/datajud/CaptacaoFilterField"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface Props {
  filters: AltoValorFilters
  onChange: (filters: AltoValorFilters) => void
}

export function AltoValorFiltersBar({ filters, onChange }: Props) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
      <CaptacaoFilterField
        value={filters.captacao}
        onChange={(captacao) => onChange({ ...filters, captacao })}
        id="filtro-captacao-alto"
      />
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
        <Label>Valor mín. (R$)</Label>
        <Input
          type="number"
          min={0}
          value={filters.valorMin}
          onChange={(e) => onChange({ ...filters, valorMin: e.target.value })}
          placeholder="500000"
        />
      </div>
      <div className="space-y-1.5">
        <Label>Faixa +500k</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.altoValor}
          onChange={(e) =>
            onChange({
              ...filters,
              altoValor: e.target.value as AltoValorFilters["altoValor"],
            })
          }
        >
          <option value="all">Todos</option>
          <option value="sim">≥ R$ 500 mil (confirmado)</option>
          <option value="nao">Abaixo de R$ 500 mil</option>
          <option value="desconhecido">Valor não informado</option>
        </select>
      </div>
      <div className="space-y-1.5">
        <Label>Classe execução</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.classeExecucao}
          onChange={(e) =>
            onChange({
              ...filters,
              classeExecucao: e.target.value as AltoValorFilters["classeExecucao"],
            })
          }
        >
          <option value="all">Todas</option>
          <option value="sim">Classe de execução</option>
          <option value="nao">Outras classes</option>
        </select>
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
