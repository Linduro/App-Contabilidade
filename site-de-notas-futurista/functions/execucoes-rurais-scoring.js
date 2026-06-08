const BANCOS_GRANDE_PORTE =
  /banco do brasil|bradesco|itau|itaú|caixa economica|caixa econ|sicredi|sicoob|banco safra|santander/i

function daysSince(iso) {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

function computeExecucaoScore(data) {
  const motivos = []
  let score = 0
  const valor = Number(data.valor_execucao) || 0

  if (valor >= 500000) {
    score += 30
    motivos.push("valor ≥500k (+30)")
  } else if (valor >= 200000) {
    score += 40
    motivos.push("valor ≥200k (+40)")
  }

  if (String(data.tribunal || "").toUpperCase().includes("TRF3")) {
    score += 20
    motivos.push("TRF3 (+20)")
  }

  if (data.area_hectares > 0 || data.car_numero || data.nirf) {
    score += 20
    motivos.push("imóvel rural (+20)")
  }

  const diasSemMov = daysSince(data.ultima_movimentacao || data.data_ajuizamento)
  if (diasSemMov >= 60) {
    score += 15
    motivos.push("sem movimentação 60d (+15)")
  }

  if (data.comarca_interior) {
    score += 15
    motivos.push("interior (+15)")
  }

  if (Number(data.processos_simultaneos) >= 2) {
    score += 10
    motivos.push("múltiplas execuções (+10)")
  }

  if (BANCOS_GRANDE_PORTE.test(String(data.credor_exequente || ""))) {
    score += 10
    motivos.push("banco grande (+10)")
  }

  if (data.advogado_recente) {
    score -= 20
    motivos.push("advogado recente (-20)")
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    score_motivo: motivos.join("; ") || "base",
  }
}

async function handleExecucaoScoring(change, context) {
  const after = change.after.exists ? change.after.data() : null
  if (!after) return null

  const { score, score_motivo } = computeExecucaoScore(after)
  if (after.score === score && after.score_motivo === score_motivo) return null

  await change.after.ref.update({
    score,
    score_motivo,
    updated_at: new Date().toISOString(),
  })
  return null
}

module.exports = { scoreExecucaoRuralOnWrite: handleExecucaoScoring, computeExecucaoScore }
