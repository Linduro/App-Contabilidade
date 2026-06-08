/**
 * Score de prioridade (0–100) para leads trabalhistas.
 * Usado apenas em Cloud Functions (sem HTTP externo).
 */

function daysSince(isoDate) {
  if (!isoDate) return 0
  const then = new Date(isoDate)
  if (Number.isNaN(then.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - then.getTime()) / 86400000))
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function computeLeadScore(lead) {
  const motivos = []
  let score = 0

  const valor = Number(lead.valor_causa) || 0
  if (valor >= 500000) {
    score += 25
    motivos.push("valor alto (+25)")
  } else if (valor >= 100000) {
    score += 18
    motivos.push("valor médio-alto (+18)")
  } else if (valor >= 30000) {
    score += 12
    motivos.push("valor médio (+12)")
  } else if (valor >= 10000) {
    score += 6
    motivos.push("valor baixo (+6)")
  }

  const dias = daysSince(lead.data_ajuizamento)
  if (dias <= 30) {
    score += 20
    motivos.push("ajuizado recente (+20)")
  } else if (dias <= 90) {
    score += 14
    motivos.push("ajuizado até 90d (+14)")
  } else if (dias <= 180) {
    score += 8
    motivos.push("ajuizado até 180d (+8)")
  }

  if (lead.sem_movimentacao_posterior) {
    score += 15
    motivos.push("sem movimentação (+15)")
  }

  const simultaneos = Number(lead.processos_simultaneos) || 0
  if (simultaneos >= 3) {
    score += 15
    motivos.push("3+ processos (+15)")
  } else if (simultaneos >= 2) {
    score += 10
    motivos.push("2 processos (+10)")
  } else if (simultaneos >= 1) {
    score += 5
    motivos.push("processo adicional (+5)")
  }

  const setor = String(lead.setor || "").toLowerCase()
  if (setor === "agro" || setor === "construcao") {
    score += 15
    motivos.push(`setor ${setor} (+15)`)
  }

  if (lead.comarca_interior) {
    score += 10
    motivos.push("comarca interior (+10)")
  }

  return {
    score: clamp(Math.round(score), 0, 100),
    score_motivo: motivos.join("; ") || "sem critérios",
  }
}

function outreachScheduleFromNow() {
  const now = Date.now()
  const dayMs = 86400000
  return [0, 3, 7, 14].map((dia) => ({
    dia,
    scheduled_at: new Date(now + dia * dayMs).toISOString(),
  }))
}

module.exports = { computeLeadScore, outreachScheduleFromNow, daysSince }
