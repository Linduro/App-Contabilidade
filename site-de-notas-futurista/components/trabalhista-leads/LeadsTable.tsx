"use client"

import { CaptacaoBadge } from "@/components/datajud/CaptacaoBadge"
import type { Lead } from "@/lib/trabalhista-leads/types"
import { LEAD_STATUS_LABELS } from "@/lib/trabalhista-leads/types"

function formatCurrency(value: number | null) {
  if (value == null || value <= 0) return "—"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface LeadsTableProps {
  leads: Lead[]
  onSelect: (lead: Lead) => void
}

export function LeadsTable({ leads, onSelect }: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum lead com os filtros atuais. Clique em Buscar agora para importar processos do Datajud.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Processo</th>
            <th className="px-4 py-3">Comarca / Vara</th>
            <th className="px-4 py-3">Captação</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
              onClick={() => onSelect(lead)}
            >
              <td className="px-4 py-3">
                <span className="font-medium">{lead.empresa}</span>
                {lead.responsavel && (
                  <p className="text-xs text-muted-foreground">{lead.responsavel}</p>
                )}
              </td>
              <td className="px-4 py-3 font-mono text-xs">
                {lead.numero_processo_formatado ?? lead.numero_processo}
              </td>
              <td className="px-4 py-3 text-xs">
                {lead.comarca ?? "—"}
                {lead.vara && (
                  <span className="block text-muted-foreground">{lead.vara}</span>
                )}
              </td>
              <td className="px-4 py-3">
                <CaptacaoBadge
                  temAdvogado={lead.tem_advogado}
                  capaDatajud={lead.capa_datajud}
                />
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                {formatCurrency(lead.valor_causa)}
              </td>
              <td className="px-4 py-3">
                <span className="rounded bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  {lead.score}
                </span>
              </td>
              <td className="px-4 py-3">
                {LEAD_STATUS_LABELS[lead.status]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
