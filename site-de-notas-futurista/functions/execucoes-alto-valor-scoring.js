const BANCOS =
  /banco do brasil|bradesco|itau|itaú|caixa economica|caixa econ|sicredi|sicoob|santander/i

function daysSince(iso) {
  if (!iso) return 0
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((Date.now() - t) / 86400000))
}

function computeAltoValorScore(data) {
  const motivos = []
  let score = 0
  const valor = Number(data.valorCausa) || 0

  if (valor >= 2_000_000) {
    score += 20
    motivos.push("valor ≥2M (+20)")
  }
  if (valor >= 1_000_000) {
    score += 40
    motivos.push("valor ≥1M (+40)")
  }

  if (BANCOS.test(String(data.exequente || ""))) {
    score += 20
    motivos.push("inst. financeira (+20)")
  }

  const diasSemMov = daysSince(data.ultimoMovimento || data.dataAjuizamento)
  if (diasSemMov >= 30) {
    score += 15
    motivos.push("sem mov. executado 30d (+15)")
  }

  if (data.tipoExecutado === "PJ" && data.cnaeRural) {
    score += 15
    motivos.push("CNAE rural (+15)")
  }

  if (data.comarcaInterior) {
    score += 10
    motivos.push("interior (+10)")
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    scoreMotivo: motivos.join("; ") || "base",
  }
}

async function handleAltoValorScoring(change) {
  const after = change.after.exists ? change.after.data() : null
  if (!after) return null

  const { score, scoreMotivo } = computeAltoValorScore(after)
  if (after.score === score && after.scoreMotivo === scoreMotivo) return null

  await change.after.ref.update({
    score,
    scoreMotivo,
    atualizadoEm: new Date().toISOString(),
  })
  return null
}

module.exports = { scoreExecucaoAltoValorOnWrite: handleAltoValorScoring, computeAltoValorScore }
