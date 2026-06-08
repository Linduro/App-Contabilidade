"use client"

import type { ExecucaoAltoValor, ExecucaoAltoValorStatus } from "@/lib/execucoes-alto-valor/types"
import { ALTO_VALOR_STATUS_LABELS } from "@/lib/execucoes-alto-valor/types"

interface Props {
  items: ExecucaoAltoValor[]
  onStatusChange: (id: string, status: ExecucaoAltoValorStatus) => void
}

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function AltoValorTable({ items, onStatusChange }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhuma execução acima de R$ 500k com os filtros atuais. Use Buscar agora para consultar o Datajud.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Executado</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Exequente</th>
            <th className="px-4 py-3">Comarca</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-4 py-3">
                <p className="font-medium">{item.executado}</p>
                <p className="text-xs text-muted-foreground">{item.processo}</p>
              </td>
              <td className="px-4 py-3 whitespace-nowrap font-medium">
                {formatCurrency(item.valorCausa)}
              </td>
              <td className="px-4 py-3 max-w-[200px] truncate">{item.exequente ?? "—"}</td>
              <td className="px-4 py-3 text-xs">{item.comarca ?? "—"}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  {item.score}
                </span>
              </td>
              <td className="px-4 py-3">
                <select
                  className="h-8 rounded border bg-background px-2 text-xs"
                  value={item.status}
                  onChange={(e) =>
                    onStatusChange(item.id, e.target.value as ExecucaoAltoValorStatus)
                  }
                >
                  {Object.entries(ALTO_VALOR_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
