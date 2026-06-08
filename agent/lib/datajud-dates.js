/** Janela padrão: 2 meses */
const DATAJUD_SEARCH_DAYS = 60

function daysAgoCompact(days = DATAJUD_SEARCH_DAYS) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}000000`
}

function todayCompactEnd() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${day}235959`
}

function ymdToCompactStart(ymd) {
  const digits = String(ymd || "").replace(/\D/g, "")
  if (digits.length < 8) return daysAgoCompact()
  return `${digits.slice(0, 8)}000000`
}

function ymdToCompactEnd(ymd) {
  const digits = String(ymd || "").replace(/\D/g, "")
  if (digits.length < 8) return todayCompactEnd()
  return `${digits.slice(0, 8)}235959`
}

function buildAjuizamentoRange({ daysBack, dataDe, dataAte }) {
  const days = daysBack ?? DATAJUD_SEARCH_DAYS
  return {
    range: {
      dataAjuizamento: {
        gte: dataDe ? ymdToCompactStart(dataDe) : daysAgoCompact(days),
        lte: dataAte ? ymdToCompactEnd(dataAte) : todayCompactEnd(),
      },
    },
  }
}

module.exports = {
  DATAJUD_SEARCH_DAYS,
  daysAgoCompact,
  todayCompactEnd,
  buildAjuizamentoRange,
}
