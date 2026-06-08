import { toYmd, todayLocalYmd } from "@/lib/licitacoes/date-filter"
import {
  DATAJUD_SEARCH_DAYS,
  daysAgoCompact,
  todayCompactEnd,
  ymdToCompactEnd,
  ymdToCompactStart,
} from "@/lib/datajud/compact-date"

export { DATAJUD_SEARCH_DAYS }

export function daysAgoYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toYmd(d.toISOString()) ?? todayLocalYmd()
}

export function matchesDataRange(
  iso: string | null | undefined,
  dataDe: string,
  dataAte: string,
): boolean {
  const ymd = toYmd(iso)
  if (!ymd) return !dataDe && !dataAte
  if (dataDe && ymd < dataDe) return false
  if (dataAte && ymd > dataAte) return false
  return true
}

export interface DatajudSearchRange {
  dataDe?: string
  dataAte?: string
  daysBack?: number
}

export function buildAjuizamentoRange(params: DatajudSearchRange) {
  const days = params.daysBack ?? DATAJUD_SEARCH_DAYS
  const gte = params.dataDe ? ymdToCompactStart(params.dataDe) : daysAgoCompact(days)
  const range: { gte: string; lte: string } = {
    gte,
    lte: params.dataAte ? ymdToCompactEnd(params.dataAte) : todayCompactEnd(),
  }
  return { range: { dataAjuizamento: range } }
}
