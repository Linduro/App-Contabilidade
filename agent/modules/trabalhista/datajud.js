const { getConfig } = require("../../lib/config-loader")
const {
  CLASSES_TRT,
  buildSearchBody,
  trtEndpoint,
  postSearch,
  extractComarcaFromOrgao,
  commonParseFields,
} = require("../../lib/datajud-query")

async function fetchRecentLaborCases(trt, daysBack, size, apiKey) {
  const body = buildSearchBody({
    daysBack,
    size,
    classCodes: CLASSES_TRT,
  })

  const hits = await postSearch(trtEndpoint(trt), body, apiKey, `TRT-${trt}`)
  return hits.map((hit) => parseDatajudHit(hit, trt)).filter(Boolean)
}

function normalizeProcesso(num) {
  return String(num || "").replace(/\D/g, "")
}

function extractCnpjFromParte(parte) {
  const docs = parte.documentosPrincipais || parte.documentos || []
  for (const doc of docs) {
    const digits = String(doc.numero || doc).replace(/\D/g, "")
    if (digits.length === 14) return digits
  }
  const match = String(parte.nome || "").match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
  return match ? match[0].replace(/\D/g, "") : null
}

function isPessoaJuridica(parte) {
  const tipo = String(parte.tipoPessoa || parte.tipo || "").toUpperCase()
  if (tipo.includes("JUR") || tipo === "PJ") return true
  return Boolean(extractCnpjFromParte(parte))
}

function isPoloPassivo(parte) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("RÉU") || polo.includes("REU")
}

function hasAdvogadoConstituido(source) {
  if (Array.isArray(source.advogados) && source.advogados.length) return true
  for (const parte of source.partes || source.dadosBasicos?.partes || []) {
    if (!isPoloPassivo(parte)) continue
    const reps = parte.advogados || parte.representantes || []
    if (Array.isArray(reps) && reps.length) return true
  }
  return false
}

function parseDatajudHit(hit, trt) {
  const source = hit._source || hit.source || {}
  const numeroProcesso = normalizeProcesso(source.numeroProcesso)
  if (!numeroProcesso) return null

  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || `TRT-${trt}`
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const assuntos = (source.assuntos || [])
    .map((a) => a.nome || a.descricao || "")
    .filter(Boolean)
    .join("; ")
  const partes = source.partes || source.dadosBasicos?.partes || []
  const common = commonParseFields(source)

  if (!partes.length) {
    return {
      numero_processo: numeroProcesso,
      numero_processo_formatado: source.numeroProcesso || numeroProcesso,
      empresa: "Réu a identificar (capa Datajud)",
      cnpj: null,
      vara,
      comarca,
      tribunal: `TRT-${trt}`,
      valor_causa: common.valor_causa,
      data_ajuizamento: source.dataAjuizamento || source.dataHoraAjuizamento || null,
      ultima_movimentacao: common.ultima_movimentacao,
      sem_movimentacao_posterior: true,
      setor: /agro|fazenda|pecu/i.test(assuntos) ? "agro" : "outros",
      comarca_interior: true,
      classe_codigo: common.classe_codigo,
      classe_nome: common.classe_nome,
      assuntos: assuntos || null,
      grau: common.grau,
      nivel_sigilo: common.nivel_sigilo,
      movimentos: common.movimentos,
      capa_datajud: true,
      dados_brutos: { datajud: source, trt },
    }
  }

  if (hasAdvogadoConstituido(source)) return null

  const reusPj = partes.filter((p) => isPoloPassivo(p) && isPessoaJuridica(p))
  if (!reusPj.length) return null

  const reu = reusPj[0]
  const empresa = String(reu.nome || "Empresa não identificada").trim()

  return {
    numero_processo: numeroProcesso,
    numero_processo_formatado: source.numeroProcesso || numeroProcesso,
    empresa,
    cnpj: extractCnpjFromParte(reu),
    vara,
    comarca,
    tribunal: `TRT-${trt}`,
    valor_causa: common.valor_causa,
    data_ajuizamento: source.dataAjuizamento || source.dataHoraAjuizamento || null,
    ultima_movimentacao: common.ultima_movimentacao,
    sem_movimentacao_posterior: true,
    setor: /agro|fazenda|pecu/i.test(`${empresa} ${assuntos}`) ? "agro" : "outros",
    comarca_interior: true,
    classe_codigo: common.classe_codigo,
    classe_nome: common.classe_nome,
    assuntos: assuntos || null,
    grau: common.grau,
    nivel_sigilo: common.nivel_sigilo,
    movimentos: common.movimentos,
    capa_datajud: false,
    dados_brutos: { datajud: source, trt },
  }
}

async function collectAllTrts() {
  const config = getConfig()
  if (!config.datajudApiKey) {
    throw new Error("DATAJUD_API_KEY não configurada.")
  }

  const results = []
  for (const trt of config.datajudTrts) {
    try {
      const cases = await fetchRecentLaborCases(
        trt,
        config.collectDaysBack,
        config.collectPageSize,
        config.datajudApiKey,
      )
      results.push(...cases)
      console.log(`[datajud] TRT-${trt}: ${cases.length} candidato(s)`)
    } catch (error) {
      console.error(`[datajud] TRT-${trt} falhou:`, error.message)
    }
  }
  return results
}

module.exports = { collectAllTrts }
