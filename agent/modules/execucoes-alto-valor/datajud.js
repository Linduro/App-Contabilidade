const { getConfig } = require("../../lib/config-loader")
const { runTriage } = require("../../lib/triage-runner")
const {
  ALTO_VALOR_MIN,
  buildBroadSearchBody,
  endpoint,
  fetchAllPages,
  extractComarcaFromOrgao,
  commonParseFields,
  normalizeProcesso,
} = require("../../lib/datajud-query")

const TRIBUNAIS = [
  { alias: "tjsp", label: "TJSP" },
  { alias: "trf3", label: "TRF3" },
  { alias: "tjrj", label: "TJRJ" },
  { alias: "tjmg", label: "TJMG" },
  { alias: "tjrs", label: "TJRS" },
  { alias: "tjpr", label: "TJPR" },
  { alias: "tjsc", label: "TJSC" },
  { alias: "tjba", label: "TJBA" },
]

function mapHitToRecord(hit, tribunalLabel) {
  const source = hit._source || {}
  const numero_processo = normalizeProcesso(source.numeroProcesso)
  if (!numero_processo) return null

  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || tribunalLabel
  const common = commonParseFields(source)

  return {
    numero_processo,
    numeroProcesso: numero_processo,
    numero_processo_formatado: source.numeroProcesso,
    processo: source.numeroProcesso || numero_processo,
    tribunal: tribunalLabel,
    vara,
    comarca: extractComarcaFromOrgao(orgao, vara),
    dataAjuizamento: source.dataAjuizamento || null,
    ultima_movimentacao: common.ultima_movimentacao,
    grau: common.grau,
    nivel_sigilo: common.nivel_sigilo,
    classe_codigo: common.classe_codigo,
    classe_nome: common.classe_nome,
    valor_causa: common.valor_causa,
    assuntos: common.assuntos,
    movimentos: common.movimentos,
    partes: common.partes,
    comarcaInterior: true,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}

async function fetchAllFromTribunal(alias, label, daysBack, size, maxPages, apiKey) {
  const body = buildBroadSearchBody({ daysBack, size })
  const hits = await fetchAllPages(endpoint(alias), body, apiKey, label, maxPages)
  return hits.map((h) => mapHitToRecord(h, label)).filter(Boolean)
}

async function collectAllAltoValor() {
  const config = getConfig()
  if (!config.datajudApiKey) throw new Error("DATAJUD_API_KEY ausente")

  const brutos = []
  for (const t of TRIBUNAIS) {
    try {
      const rows = await fetchAllFromTribunal(
        t.alias,
        t.label,
        config.altoValorDaysBack,
        config.collectPageSize,
        config.datajudMaxPages,
        config.datajudApiKey,
      )
      brutos.push(...rows)
      console.log(`[datajud] ${t.label}: ${rows.length} processo(s) bruto(s)`)
    } catch (e) {
      console.error(`[datajud] ${t.label}:`, e.message)
    }
  }

  console.log(`[datajud] total bruto: ${brutos.length} — iniciando triagem Python…`)
  const { records, stats } = runTriage("execucoesAltoValor", brutos)
  console.log(
    `[triagem] execucoesAltoValor: ${stats.aprovados}/${stats.total} aprovados`,
    stats.motivos_rejeicao || {},
  )
  return records
}

module.exports = { collectAllAltoValor, ALTO_VALOR_MIN }
