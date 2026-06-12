import type { AdvogadoStatus } from "@/lib/datajud/advogado-detect"

interface CaptacaoBadgeProps {
  temAdvogado: AdvogadoStatus
  capaDatajud?: boolean
}

export function CaptacaoBadge({ temAdvogado, capaDatajud }: CaptacaoBadgeProps) {
  if (temAdvogado === true) {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Com adv.
      </span>
    )
  }
  if (temAdvogado === false) {
    return (
      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
        Sem adv.
      </span>
    )
  }
  if (capaDatajud) {
    return (
      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
        Capa — verificar
      </span>
    )
  }
  return (
    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      Adv. ?
    </span>
  )
}
