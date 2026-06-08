/**
 * Triagem no browser — espelha agent/triage/triagem/modulos/*.py
 */
import { DATAJUD_SEARCH_DAYS, isWithinDaysBack } from "@/lib/datajud/compact-date"
import { parseTrabalhistaSource } from "@/lib/datajud/trabalhista-parse"
import { parseExecucaoSource } from "@/lib/datajud/execucoes-parse"
import { parseAltoValorSource } from "@/lib/datajud/alto-valor-parse"
import { codigosForNatureza, NATUREZAS_TRABALHISTA, NATUREZAS_EXECUCAO } from "@/lib/datajud/naturezas"

export { DATAJUD_SEARCH_DAYS }

export function triageTrabalhista(
  sources: Record<string, unknown>[],
  trt: number,
  naturezaId = "all",
) {
  const classCodes = codigosForNatureza(NATUREZAS_TRABALHISTA, naturezaId)
  const out: NonNullable<ReturnType<typeof parseTrabalhistaSource>>[] = []

  for (const source of sources) {
    if (!isWithinDaysBack(source.dataAjuizamento as string)) continue
    const parsed = parseTrabalhistaSource(source, trt)
    if (!parsed) continue
    if (classCodes.length && parsed.classe_codigo != null && !classCodes.includes(parsed.classe_codigo)) {
      continue
    }
    out.push(parsed)
  }
  return out
}

export function triageExecucaoRural(
  sources: Record<string, unknown>[],
  tribunalLabel: string,
  naturezaId = "all",
) {
  const classCodes = codigosForNatureza(NATUREZAS_EXECUCAO, naturezaId)
  const out: NonNullable<ReturnType<typeof parseExecucaoSource>>[] = []

  for (const source of sources) {
    if (!isWithinDaysBack(source.dataAjuizamento as string)) continue
    const parsed = parseExecucaoSource(source, tribunalLabel)
    if (!parsed) continue
    if (classCodes.length && parsed.classe_codigo != null && !classCodes.includes(parsed.classe_codigo)) {
      continue
    }
    out.push(parsed)
  }
  return out
}

export function triageAltoValor(
  sources: Record<string, unknown>[],
  tribunalLabel: string,
) {
  const out: NonNullable<ReturnType<typeof parseAltoValorSource>>[] = []

  for (const source of sources) {
    if (!isWithinDaysBack(source.dataAjuizamento as string)) continue
    const parsed = parseAltoValorSource(source, tribunalLabel)
    if (parsed) out.push(parsed)
  }
  return out
}
