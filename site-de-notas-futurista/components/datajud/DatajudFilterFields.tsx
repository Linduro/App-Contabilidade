"use client"

import type { NaturezaAcao } from "@/lib/datajud/naturezas"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface DateNaturezaFields {
  dataDe: string
  dataAte: string
  natureza: string
}

interface Props {
  filters: DateNaturezaFields
  onChange: (filters: DateNaturezaFields) => void
  naturezas: NaturezaAcao[]
  extraFields?: React.ReactNode
}

export function DatajudFilterFields({
  filters,
  onChange,
  naturezas,
  extraFields,
}: Props) {
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-data-de">Ajuizamento de</Label>
        <Input
          id="filtro-data-de"
          type="date"
          value={filters.dataDe}
          onChange={(e) => onChange({ ...filters, dataDe: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-data-ate">Ajuizamento até</Label>
        <Input
          id="filtro-data-ate"
          type="date"
          value={filters.dataAte}
          onChange={(e) => onChange({ ...filters, dataAte: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="filtro-natureza">Natureza da ação</Label>
        <select
          id="filtro-natureza"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={filters.natureza}
          onChange={(e) => onChange({ ...filters, natureza: e.target.value })}
        >
          {naturezas.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
            </option>
          ))}
        </select>
      </div>
      {extraFields}
    </>
  )
}
