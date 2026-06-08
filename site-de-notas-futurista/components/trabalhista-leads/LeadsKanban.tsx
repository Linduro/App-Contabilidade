"use client"

import type { Lead, LeadStatus } from "@/lib/trabalhista-leads/types"
import { LEAD_STATUS_LABELS } from "@/lib/trabalhista-leads/types"
import { cn } from "@/lib/utils"

const COLUMNS: LeadStatus[] = ["novo", "contatado", "respondeu", "cliente"]

interface LeadsKanbanProps {
  leads: Lead[]
  onStatusChange: (leadId: string, status: LeadStatus) => void
  onSelect: (lead: Lead) => void
}

export function LeadsKanban({ leads, onStatusChange, onSelect }: LeadsKanbanProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((status) => {
        const column = leads.filter((l) => l.status === status)
        return (
          <div
            key={status}
            className="rounded-xl border bg-card/50 p-4"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {LEAD_STATUS_LABELS[status]}
              </h3>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {column.length}
              </span>
            </div>
            <div className="space-y-2">
              {column.length === 0 ? (
                <p className="text-xs text-muted-foreground">Vazio</p>
              ) : (
                column.map((lead) => (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => onSelect(lead)}
                    className={cn(
                      "w-full rounded-lg border border-border/60 bg-background p-3 text-left",
                      "transition hover:border-primary/40 hover:bg-primary/5",
                    )}
                  >
                    <p className="truncate text-sm font-medium">{lead.empresa}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {lead.vara ?? lead.comarca ?? "—"}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-primary">
                        Score {lead.score}
                      </span>
                      <select
                        className="h-7 max-w-[110px] rounded border bg-background px-1 text-[10px]"
                        value={lead.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          onStatusChange(lead.id, e.target.value as LeadStatus)
                        }
                      >
                        {COLUMNS.map((s) => (
                          <option key={s} value={s}>
                            {LEAD_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
