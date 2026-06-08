const {
  ALTO_VALOR_MIN,
  CLASSES_EXECUCAO,
  buildSearchBody,
  endpoint,
  postSearch,
  extractComarcaFromOrgao,
  commonParseFields,
} = require("../../lib/datajud-query")

const CLASSES = new Set(CLASSES_EXECUCAO)

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

function isPoloPassivo(parte) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function semAdvogado(parte) {
  const reps = parte.representantes || parte.advogados || []
  return !Array.isArray(reps) || reps.length === 0
}

function extractDoc(parte) {
  const docs = parte.documentosPrincipais || parte.documentos || []
  for (const doc of docs) {
    const digits = String(doc.numero || doc).replace(/\D/g, "")
    if (digits.length === 11 || digits.length === 14) return digits
  }
  return null
}

function parseHit(hit, tribunalLabel) {
  const source = hit._source || {}
  const common = commonParseFields(source)
  const classe = common.classe_codigo
  if (classe == null || !CLASSES.has(classe)) return null

  const partes = source.partes || []
  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || tribunalLabel
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const numeroProcesso = String(source.numeroProcesso || "").replace(/\D/g, "")
  if (!numeroProcesso) return null

  const valorCausa = common.valor_causa

  if (!partes.length) {
    return {
      numeroProcesso,
      processo: String(source.numeroProcesso || numeroProcesso),
      tribunal: tribunalLabel,
      vara,
      comarca,
      valorCausa,
      exequente: null,
      executado: "Executado a identificar (capa Datajud)",
      cnpjCpf: "",
      tipoExecutado: "PF",
      dataAjuizamento: source.dataAjuizamento || null,
      ultimoMovimento: common.ultima_movimentacao,
      temAdvogado: false,
      comarcaInterior: true,
      cnaeRural: false,
      capaDatajud: true,
      grau: common.grau,
      nivelSigilo: common.nivel_sigilo,
      classeCodigo: common.classe_codigo,
      classeNome: common.classe_nome,
      movimentos: common.movimentos,
      dadosBrutos: source,
    }
  }

  if (valorCausa > 0 && valorCausa < ALTO_VALOR_MIN) return null

  const executadoParte = partes.find(isPoloPassivo)
  if (!executadoParte || !semAdvogado(executadoParte)) return null

  for (const p of partes) {
    if (isPoloPassivo(p) && !semAdvogado(p)) return null
  }

  const exequenteParte = partes.find((p) => !isPoloPassivo(p))
  const executado = String(executadoParte.nome || "Executado não identificado").trim()
  const cnpjCpf = extractDoc(executadoParte) || ""

  return {
    numeroProcesso,
    processo: String(source.numeroProcesso || numeroProcesso),
    tribunal: tribunalLabel,
    vara,
    comarca,
    valorCausa,
    exequente: exequenteParte?.nome || null,
    executado,
    cnpjCpf,
    tipoExecutado: cnpjCpf.length === 14 || /ltda|s\.?a|me\b|eireli/i.test(executado) ? "PJ" : "PF",
    dataAjuizamento: source.dataAjuizamento || null,
    ultimoMovimento: common.ultima_movimentacao,
    temAdvogado: false,
    comarcaInterior: true,
    cnaeRural: false,
    capaDatajud: false,
    grau: common.grau,
    nivelSigilo: common.nivel_sigilo,
    classeCodigo: common.classe_codigo,
    classeNome: common.classe_nome,
    movimentos: common.movimentos,
    dadosBrutos: source,
  }
}

async function fetchTribunal(alias, label, daysBack, size, apiKey) {
  const body = buildSearchBody({
    daysBack,
    size,
    classCodes: CLASSES_EXECUCAO,
    minValorCausa: ALTO_VALOR_MIN,
  })

  const hits = await postSearch(endpoint(alias), body, apiKey, label)
  return hits.map((h) => parseHit(h, label)).filter(Boolean)
}

async function collectAllAltoValor() {
  const { getConfig } = require("../../lib/config-loader")
  const config = getConfig()
  if (!config.datajudApiKey) throw new Error("DATAJUD_API_KEY ausente")

  const results = []
  for (const t of TRIBUNAIS) {
    try {
      const rows = await fetchTribunal(
        t.alias,
        t.label,
        config.altoValorDaysBack,
        config.collectPageSize,
        config.datajudApiKey,
      )
      results.push(...rows)
      console.log(`[alto-valor] ${t.label}: ${rows.length} candidato(s)`)
    } catch (e) {
      console.error(`[alto-valor] ${t.label}:`, e.message)
    }
  }
  return results
}

module.exports = { collectAllAltoValor, ALTO_VALOR_MIN, parseHit }
