const { getConfig } = require("../../lib/config-loader")
const { runTriage } = require("../../lib/triage-runner")
const {
  buildBroadSearchBody,
  trtEndpoint,
  fetchAllPages,
  extractComarcaFromOrgao,
  commonParseFields,
  normalizeProcesso,
} = require("../../lib/datajud-query")

function mapHitToRecord(hit, trt) {
  const source = hit._source || hit.source || {}
  const numero_processo = normalizeProcesso(source.numeroProcesso)
  if (!numero_processo) return null

  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || `TRT-${trt}`
  const common = commonParseFields(source)

  return {
    numero_processo,
    numero_processo_formatado: source.numeroProcesso || numero_processo,
    tribunal: `TRT-${trt}`,
    vara,
    comarca: extractComarcaFromOrgao(orgao, vara),
    data_ajuizamento: source.dataAjuizamento || source.dataHoraAjuizamento || null,
    ultima_movimentacao: common.ultima_movimentacao,
    sem_movimentacao_posterior: true,
    comarca_interior: true,
    grau: common.grau,
    nivel_sigilo: common.nivel_sigilo,
    classe_codigo: common.classe_codigo,
    classe_nome: common.classe_nome,
    valor_causa: common.valor_causa,
    assuntos: common.assuntos,
    movimentos: common.movimentos,
    partes: common.partes,
    dados_brutos: { datajud: source, trt },
  }
}

async function fetchAllFromTrt(trt, daysBack, size, maxPages, apiKey) {
  const body = buildBroadSearchBody({ daysBack, size })
  const hits = await fetchAllPages(trtEndpoint(trt), body, apiKey, `TRT-${trt}`, maxPages)
  return hits.map((hit) => mapHitToRecord(hit, trt)).filter(Boolean)
}

async function collectAllTrts() {
  const config = getConfig()
  if (!config.datajudApiKey) {
    throw new Error("DATAJUD_API_KEY não configurada.")
  }

  const brutos = []
  for (const trt of config.datajudTrts) {
    try {
      const rows = await fetchAllFromTrt(
        trt,
        config.collectDaysBack,
        config.collectPageSize,
        config.datajudMaxPages,
        config.datajudApiKey,
      )
      brutos.push(...rows)
      console.log(`[datajud] TRT-${trt}: ${rows.length} processo(s) bruto(s)`)
    } catch (error) {
      console.error(`[datajud] TRT-${trt} falhou:`, error.message)
    }
  }

  console.log(`[datajud] total bruto: ${brutos.length} — iniciando triagem Python…`)
  const { records, stats } = runTriage("trabalhista", brutos)
  console.log(
    `[triagem] trabalhista: ${stats.aprovados}/${stats.total} aprovados`,
    stats.motivos_rejeicao || {},
  )
  return records
}

module.exports = { collectAllTrts }
