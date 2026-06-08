"use client"

import type { ExecucaoRural } from "@/lib/execucoes-rurais/types"
import { EXECUCAO_STATUS_LABELS, type ExecucaoStatus } from "@/lib/execucoes-rurais/types"

interface Props {
  items: ExecucaoRural[]
  onStatusChange: (id: string, status: ExecucaoStatus) => void
}

export function ExecucoesCards({ items, onStatusChange }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma execução rural com os filtros atuais. O worker na nuvem popula esta lista.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-xl border bg-card p-4">
          <h3 className="font-semibold">{item.nome_reu}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{item.processo}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {item.area_hectares != null && item.area_hectares > 0 && (
              <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                {item.area_hectares.toLocaleString("pt-BR")} ha
              </span>
            )}
            {item.credor_exequente && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                {item.credor_exequente}
              </span>
            )}
            <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              Score {item.score}
            </span>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            {item.comarca ?? item.municipio_imovel ?? "—"} · {item.tribunal}
          </p>

          {item.valor_execucao != null && (
            <p className="mt-1 text-sm font-medium">
              {item.valor_execucao.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </p>
          )}

          <select
            className="mt-3 h-8 w-full rounded border bg-background px-2 text-xs"
            value={item.status}
            onChange={(e) => onStatusChange(item.id, e.target.value as ExecucaoStatus)}
          >
            {Object.entries(EXECUCAO_STATUS_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </article>
      ))}
    </div>
  )
}
