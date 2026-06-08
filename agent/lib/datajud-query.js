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
 * Monta body Elasticsearch com filtros em `filter` (sem afetar score).
 * @param {{ daysBack: number, size: number, classCodes?: number[], minValorCausa?: number }} opts
 */
function buildSearchBody({ daysBack, size, classCodes, minValorCausa }) {
  const filter = [{ term: { nivelSigilo: 0 } }]

  if (classCodes?.length) {
    filter.push({
      bool: {
        should: [
          { terms: { "classe.codigo": classCodes } },
          { terms: { "classeProcessual.codigo": classCodes } },
        ],
        minimum_should_match: 1,
      },
    })
  }

  if (minValorCausa != null && minValorCausa > 0) {
    filter.push({
      bool: {
        should: [
          { range: { valorCausa: { gte: minValorCausa } } },
          { range: { valor: { gte: minValorCausa } } },
        ],
        minimum_should_match: 1,
      },
    })
  }

  return {
    size,
    _source: SOURCE_FIELDS,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [{ range: { dataAjuizamento: { gte: daysAgoIso(daysBack) } } }],
        filter,
      },
    },
  }
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
  }
}

module.exports = {
  DATAJUD_BASE,
  SOURCE_FIELDS,
  CLASSES_TRT,
  CLASSES_EXECUCAO,
  ALTO_VALOR_MIN,
  buildSearchBody,
  endpoint,
  trtEndpoint,
  postSearch,
  extractClasse,
  extractValor,
  extractMovimentos,
  extractUltimaMovimentacao,
  extractComarcaFromOrgao,
  commonParseFields,
}
