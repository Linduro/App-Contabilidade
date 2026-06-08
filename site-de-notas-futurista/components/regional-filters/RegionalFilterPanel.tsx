"use client"

import {
  REGIOES_CATALOG,
  citiesForRegioes,
  type RegionalFilterState,
} from "@/lib/regional-filters/regioes"

interface Props {
  filters: RegionalFilterState
  onChange: (filters: RegionalFilterState) => void
}

export function RegionalFilterPanel({ filters, onChange }: Props) {
  const cityOptions = [
    ...new Set([
      ...citiesForRegioes(filters.regioes),
      ...filters.cidades,
    ]),
  ].sort()

  const toggleRegiao = (id: string) => {
    const reg = REGIOES_CATALOG.find((r) => r.id === id)
    if (!reg) return

    if (filters.regioes.includes(id)) {
      onChange({
        regioes: filters.regioes.filter((r) => r !== id),
        cidades: filters.cidades.filter((c) => !reg.cidades.includes(c)),
      })
    } else {
      onChange({
        regioes: [...filters.regioes, id],
        cidades: [...new Set([...filters.cidades, ...reg.cidades])],
      })
    }
  }

  const toggleCidade = (cidade: string) => {
    onChange({
      ...filters,
      cidades: filters.cidades.includes(cidade)
        ? filters.cidades.filter((c) => c !== cidade)
        : [...filters.cidades, cidade],
    })
  }

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Filtro regional
      </h2>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        Independente dos outros módulos. Vazio = busca nacional.
      </p>

      <div className="space-y-1">
        <p className="text-xs font-medium">Regiões</p>
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
          {REGIOES_CATALOG.map((reg) => (
            <label key={reg.id} className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={filters.regioes.includes(reg.id)}
                onChange={() => toggleRegiao(reg.id)}
                className="mt-0.5"
              />
              <span>{reg.nome}</span>
            </label>
          ))}
        </div>
      </div>

      {cityOptions.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Cidades</p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
            {cityOptions.map((cidade) => (
              <label key={cidade} className="flex cursor-pointer items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={filters.cidades.includes(cidade)}
                  onChange={() => toggleCidade(cidade)}
                />
                <span>{cidade}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
