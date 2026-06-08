/** Janela padrão de busca processual: 2 meses. */
export const DATAJUD_SEARCH_DAYS = 60

/**
 * Datajud indexa dataAjuizamento como YYYYMMDDHHmmss (compacto).
 * Range com YYYY-MM-DD retorna resultados incorretos na API CNJ.
 */
export function daysAgoCompact(days: number = DATAJUD_SEARCH_DAYS): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}000000`
}

export function todayCompactEnd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}235959`
}

export function ymdToCompactStart(ymd: string): string {
  const digits = ymd.replace(/\D/g, "")
  if (digits.length < 8) return daysAgoCompact()
  return `${digits.slice(0, 8)}000000`
}

export function ymdToCompactEnd(ymd: string): string {
  const digits = ymd.replace(/\D/g, "")
  if (digits.length < 8) return todayCompactEnd()
  return `${digits.slice(0, 8)}235959`
}

/** Converte dataAjuizamento Datajud para comparacao YYYYMMDD. */
export function ajuizamentoYmd(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = String(raw).replace(/\D/g, "")
  return digits.length >= 8 ? digits.slice(0, 8) : null
}

export function isWithinDaysBack(
  raw: string | null | undefined,
  days: number = DATAJUD_SEARCH_DAYS,
): boolean {
  const ymd = ajuizamentoYmd(raw)
  if (!ymd) return true
  const cutoff = daysAgoCompact(days).slice(0, 8)
  return ymd >= cutoff
}
