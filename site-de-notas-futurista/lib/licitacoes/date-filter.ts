/** Data local YYYY-MM-DD (fuso do browser). */
export function todayLocalYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Extrai YYYY-MM-DD de ISO datetime ou date string. */
export function toYmd(iso: string | null | undefined): string | null {
  if (!iso) return null
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

/** True se a data for hoje ou no futuro; false se anterior a hoje. */
export function isOnOrAfterToday(iso: string | null | undefined): boolean {
  const ymd = toYmd(iso)
  if (!ymd) return true
  return ymd >= todayLocalYmd()
}

/** Licitação ainda aberta ou sem prazo — nunca encerrada antes de hoje. */
export function isOpenByDeadline(deadline: string | null | undefined): boolean {
  if (!deadline) return true
  return isOnOrAfterToday(deadline)
}

type LicitacaoDates = {
  data_publicacao?: string | null
  data_encerramento?: string | null
  dados_brutos?: Record<string, unknown> | null
}

/** Licitação válida para exibição: publicação e encerramento hoje ou futuros. */
export function isLicitacaoOnOrAfterToday(licitacao: LicitacaoDates): boolean {
  if (!isOpenByDeadline(licitacao.data_encerramento)) return false

  if (licitacao.data_publicacao && !isOnOrAfterToday(licitacao.data_publicacao)) {
    return false
  }

  const bruto = licitacao.dados_brutos as {
    deadline?: string
    publicadoEm?: string
    data_publicacao_pncp?: string
  } | null

  if (bruto?.deadline && !isOnOrAfterToday(bruto.deadline)) return false

  const publicacao =
    bruto?.publicadoEm ?? bruto?.data_publicacao_pncp ?? null
  if (publicacao && !isOnOrAfterToday(publicacao)) return false

  return true
}
