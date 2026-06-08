"use client"

import type { Lead } from "@/lib/trabalhista-leads/types"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface LeadDetailModalProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LeadDetailModal({
  lead,
  open,
  onOpenChange,
}: LeadDetailModalProps) {
  if (!lead) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{lead.empresa}</DialogTitle>
        </DialogHeader>
        <dl className="grid gap-2 text-sm">
          <Row label="CNPJ" value={lead.cnpj} />
          <Row label="Processo" value={lead.numero_processo_formatado ?? lead.numero_processo} />
          <Row label="Tribunal" value={lead.tribunal} />
          <Row label="Vara" value={lead.vara} />
          <Row label="Comarca" value={lead.comarca} />
          <Row
            label="Valor da causa"
            value={
              lead.valor_causa
                ? lead.valor_causa.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })
                : null
            }
          />
          <Row label="Responsável (QSA)" value={lead.responsavel} />
          <Row label="Telefone" value={lead.telefone} />
          <Row label="E-mail" value={lead.email} />
          <Row label="Score" value={String(lead.score)} />
          <Row label="Motivo do score" value={lead.score_motivo} />
          <Row label="Setor" value={lead.setor} />
          <Row label="Processos simultâneos" value={String(lead.processos_simultaneos)} />
        </dl>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 border-b border-border/40 py-1.5 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium break-all">{value || "—"}</dd>
    </div>
  )
}
