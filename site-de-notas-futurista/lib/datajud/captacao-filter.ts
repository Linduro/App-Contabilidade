import type { AdvogadoStatus } from "@/lib/datajud/advogado-detect"

/** Filtro manual de captação — aplicado só na UI, nunca na coleta. */
export type CaptacaoFilter = "all" | "oportunidade" | "sem_advogado" | "capa" | "com_advogado"

export const CAPTACAO_FILTER_LABELS: Record<CaptacaoFilter, string> = {
  all: "Todos os processos",
  oportunidade: "Oportunidades (sem adv. confirmado)",
  sem_advogado: "Sem advogado (confirmado)",
  capa: "Só capa (verificar manualmente)",
  com_advogado: "Com advogado",
}

export function matchesCaptacaoFilter(
  temAdvogado: AdvogadoStatus | undefined,
  capaDatajud: boolean | undefined,
  captacao: CaptacaoFilter,
): boolean {
  if (captacao === "all") return true

  const comAdv = temAdvogado === true
  const semAdv = temAdvogado === false
  const capa = capaDatajud === true || temAdvogado == null

  switch (captacao) {
    case "oportunidade":
      return !comAdv
    case "sem_advogado":
      return semAdv
    case "capa":
      return capa
    case "com_advogado":
      return comAdv
    default:
      return true
  }
}
