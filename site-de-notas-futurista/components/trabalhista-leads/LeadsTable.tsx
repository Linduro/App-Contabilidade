"use client"

import { Loader2, Send } from "lucide-react"
import type { Lead } from "@/lib/trabalhista-leads/types"
import { LEAD_STATUS_LABELS } from "@/lib/trabalhista-leads/types"
import { Button } from "@/components/ui/button"

function formatCurrency(value: number | null) {
  if (value == null || value <= 0) return "—"
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

interface LeadsTableProps {
  leads: Lead[]
  dispatchingId: string | null
  onDispatch: (leadId: string) => void
  onSelect: (lead: Lead) => void
}

export function LeadsTable({
  leads,
  dispatchingId,
  onDispatch,
  onSelect,
}: LeadsTableProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Nenhum lead com os filtros atuais. O agente local popula esta lista via Datajud.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <table className="w-full min-w-[800px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3">Empresa</th>
            <th className="px-4 py-3">Processo</th>
            <th className="px-4 py-3">Comarca / Vara</th>
            <th className="px-4 py-3">Valor</th>
            <th className="px-4 py-3">Score</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr
              key={lead.id}
              className="border-b last:border-0 hover:bg-muted/20"
            >
              <td className="px-4 py-3">
                <button
                  type="button"
                  className="font-medium text-left hover:text-primary"
                  onClick={() => onSelect(lead)}
                >
                  {lead.empresa}
                </button>
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
              <td className="px-4 py-3">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={dispatchingId === lead.id}
                  onClick={() => onDispatch(lead.id)}
                >
                  {dispatchingId === lead.id ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="mr-1 h-3 w-3" />
                  )}
                  Disparar
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
