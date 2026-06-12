"use client"

import { Label } from "@/components/ui/label"
import {
  CAPTACAO_FILTER_LABELS,
  type CaptacaoFilter,
} from "@/lib/datajud/captacao-filter"

interface CaptacaoFilterFieldProps {
  value: CaptacaoFilter
  onChange: (value: CaptacaoFilter) => void
  id?: string
}

export function CaptacaoFilterField({
  value,
  onChange,
  id = "filtro-captacao",
}: CaptacaoFilterFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Captação (manual)</Label>
      <select
        id={id}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value as CaptacaoFilter)}
      >
        {(Object.entries(CAPTACAO_FILTER_LABELS) as [CaptacaoFilter, string][]).map(
          ([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ),
        )}
      </select>
      <p className="text-xs text-muted-foreground">
        A busca salva tudo; você escolhe o que analisar aqui.
      </p>
    </div>
  )
}
