import { toYmd, todayLocalYmd } from "@/lib/licitacoes/date-filter"

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
  const gte = params.dataDe || daysAgoYmd(params.daysBack ?? 30)
  const range: { gte: string; lte?: string } = { gte }
  if (params.dataAte) range.lte = params.dataAte
  return { range: { dataAjuizamento: range } }
}
