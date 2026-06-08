const {
  DATAJUD_SEARCH_DAYS,
  buildAjuizamentoRange,
} = require("./datajud-dates")

const DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"

/** Campos solicitados explicitamente na busca Elasticsearch. */
const SOURCE_FIELDS = [
  "numeroProcesso",
  "tribunal",
  "grau",
  "classe",
  "classeProcessual",
  "dataAjuizamento",
  "dataHoraUltimaAtualizacao",
  "valorCausa",
  "valor",
  "orgaoJulgador",
  "assuntos",
  "movimentos",
  "partes",
  "nivelSigilo",
]

const CLASSES_TRT = [1225, 1236, 2342, 154]
const CLASSES_EXECUCAO = [1116, 877, 40]
const ALTO_VALOR_MIN = 500_000

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Query ampla: processos públicos nos últimos N dias (formato compacto CNJ).
 */
function buildBroadSearchBody({ daysBack, size, dataDe, dataAte }) {
  return {
    size,
    _source: SOURCE_FIELDS,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [buildAjuizamentoRange({ daysBack: daysBack ?? DATAJUD_SEARCH_DAYS, dataDe, dataAte })],
        filter: [{ term: { nivelSigilo: 0 } }],
      },
    },
  }
}

/** @deprecated Use buildBroadSearchBody — mantido para compatibilidade interna. */
function buildSearchBody(opts) {
  return buildBroadSearchBody(opts)
}

function endpoint(alias) {
  return `${DATAJUD_BASE}/api_publica_${alias}/_search`
}

function trtEndpoint(trt) {
  return `${DATAJUD_BASE}/api_publica_trt${trt}/_search`
}

async function postSearch(url, body, apiKey, label) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`${label} HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const payload = await response.json()
  return payload.hits?.hits ?? []
}

/**
 * Pagina resultados até esgotar hits ou atingir maxPages.
 */
async function fetchAllPages(url, baseBody, apiKey, label, maxPages = 20) {
  const size = baseBody.size
  const all = []

  for (let page = 0; page < maxPages; page++) {
    const body = { ...baseBody, from: page * size }
    const hits = await postSearch(url, body, apiKey, label)
    all.push(...hits)
    if (hits.length < size) break
  }

  return all
}

function normalizeProcesso(num) {
  return String(num || "").replace(/\D/g, "")
}

function extractAssuntosText(source) {
  const assuntos = source.assuntos
  if (!Array.isArray(assuntos)) return ""
  return assuntos
    .map((a) => a.nome || a.descricao || "")
    .filter(Boolean)
    .join("; ")
}

function extractClasse(source) {
  const c = source.classe || source.classeProcessual || {}
  const codigo = c.codigo ?? c.code ?? c.numero ?? null
  const nome = c.nome ?? c.descricao ?? c.name ?? null
  return {
    classe_codigo: codigo != null ? Number(codigo) : null,
    classe_nome: nome != null ? String(nome) : null,
  }
}

function extractValor(source) {
  const raw = source.valorCausa ?? source.valor
  if (raw == null || raw === "") return 0
  const n = parseFloat(String(raw))
  return Number.isFinite(n) ? n : 0
}

function extractMovimentos(source, limit = 15) {
  const movs = Array.isArray(source.movimentos) ? [...source.movimentos] : []
  movs.sort((a, b) => {
    const ta = new Date(a.dataHora || 0).getTime()
    const tb = new Date(b.dataHora || 0).getTime()
    return tb - ta
  })
  return movs.slice(0, limit).map((m) => ({
    codigo: m.codigo ?? null,
    nome: m.nome != null ? String(m.nome) : null,
    dataHora: m.dataHora ?? null,
  }))
}

function extractUltimaMovimentacao(source) {
  const movs = extractMovimentos(source, 1)
  if (movs[0]?.dataHora) return movs[0].dataHora
  return (
    source.dataHoraUltimaAtualizacao ||
    source.dataUltimaAtualizacao ||
    source.dataAjuizamento ||
    null
  )
}

function extractComarcaFromOrgao(orgao, fallback) {
  const explicit = orgao.municipioNome || orgao.nomeMunicipio
  if (explicit) return String(explicit).trim()
  const nome = String(orgao.nome || orgao.nomeOrgao || "").trim()
  const deMatch = nome.match(/\bde\s+(.+?)(?:\s*[-–—]|$)/i)
  if (deMatch?.[1]) return deMatch[1].trim()
  return fallback
}

function extractPartes(source) {
  const raw = source.partes || source.dadosBasicos?.partes || []
  return Array.isArray(raw) ? raw : []
}

function commonParseFields(source) {
  const { classe_codigo, classe_nome } = extractClasse(source)
  return {
    grau: source.grau != null ? String(source.grau) : null,
    nivel_sigilo: source.nivelSigilo != null ? Number(source.nivelSigilo) : 0,
    classe_codigo,
    classe_nome,
    movimentos: extractMovimentos(source),
    ultima_movimentacao: extractUltimaMovimentacao(source),
    valor_causa: extractValor(source),
    assuntos: extractAssuntosText(source),
    partes: extractPartes(source),
  }
}

module.exports = {
  DATAJUD_BASE,
  SOURCE_FIELDS,
  DATAJUD_SEARCH_DAYS,
  CLASSES_TRT,
  CLASSES_EXECUCAO,
  ALTO_VALOR_MIN,
  buildBroadSearchBody,
  buildSearchBody,
  endpoint,
  trtEndpoint,
  postSearch,
  fetchAllPages,
  normalizeProcesso,
  extractClasse,
  extractValor,
  extractMovimentos,
  extractUltimaMovimentacao,
  extractComarcaFromOrgao,
  extractAssuntosText,
  extractPartes,
  commonParseFields,
}
