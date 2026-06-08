export interface NaturezaAcao {
  id: string
  label: string
  codigos: number[]
}

export const NATUREZAS_TRABALHISTA: NaturezaAcao[] = [
  { id: "all", label: "Todas as naturezas", codigos: [] },
  { id: "reclamacao", label: "Reclamação Trabalhista", codigos: [985] },
  { id: "acao_trabalhista", label: "Ação Trabalhista", codigos: [1125] },
  { id: "execucao_trabalhista", label: "Execução Trabalhista", codigos: [872] },
  { id: "cumprimento", label: "Cumprimento de Sentença", codigos: [993, 994] },
  { id: "acao_civil_publica", label: "Ação Civil Pública Trabalhista", codigos: [991] },
  { id: "mandado_seguranca", label: "Mandado de Segurança Trabalhista", codigos: [120] },
]

export const NATUREZAS_EXECUCAO: NaturezaAcao[] = [
  { id: "all", label: "Todas as naturezas", codigos: [] },
  { id: "titulo_extrajudicial", label: "Execução de Título Extrajudicial", codigos: [1116] },
  { id: "execucao", label: "Execução", codigos: [877] },
  { id: "acao_execucao", label: "Ação de Execução", codigos: [40] },
]

export function naturezaById(
  catalog: NaturezaAcao[],
  id: string,
): NaturezaAcao | undefined {
  return catalog.find((n) => n.id === id)
}

export function codigosForNatureza(
  catalog: NaturezaAcao[],
  naturezaId: string,
): number[] {
  if (!naturezaId || naturezaId === "all") return []
  return naturezaById(catalog, naturezaId)?.codigos ?? []
}

export function matchesNaturezaCodigo(
  codigo: number | string | null | undefined,
  naturezaId: string,
  catalog: NaturezaAcao[],
): boolean {
  const codigos = codigosForNatureza(catalog, naturezaId)
  if (codigos.length === 0) return true
  if (codigo == null) return false
  const n = Number(codigo)
  return codigos.includes(n)
}

export function labelForCodigo(
  catalog: NaturezaAcao[],
  codigo: number | null | undefined,
): string | null {
  if (codigo == null) return null
  for (const n of catalog) {
    if (n.codigos.includes(codigo)) return n.label
  }
  return null
}
