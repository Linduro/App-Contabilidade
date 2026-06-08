const { getConfig } = require("../../lib/config-loader")
const {
  CLASSES_EXECUCAO,
  buildSearchBody,
  endpoint,
  postSearch,
  extractComarcaFromOrgao,
  commonParseFields,
} = require("../../lib/datajud-query")

const CLASSES_SET = new Set([...CLASSES_EXECUCAO, ...CLASSES_EXECUCAO.map(String)])

const TRIBUNAIS = [
  { alias: "tjsp", label: "TJSP" },
  { alias: "trf3", label: "TRF3" },
]

function hasAdvogadoPassivo(source) {
  const partes = source.partes || []
  for (const parte of partes) {
    const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
    if (!polo.includes("PASSIV") && !polo.includes("REU") && !polo.includes("RÉU")) continue
    const reps = parte.advogados || parte.representantes || []
    if (Array.isArray(reps) && reps.length > 0) return true
  }
  return Boolean(source.advogados?.length || source.representantes?.length)
}

function isPoloPassivo(parte) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("REU") || polo.includes("RÉU")
}

function parseHit(hit, tribunalLabel) {
  const source = hit._source || {}
  const common = commonParseFields(source)
  const classe = common.classe_codigo
  if (classe != null && !CLASSES_SET.has(classe) && !CLASSES_SET.has(String(classe))) return null

  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || tribunalLabel
  const comarca = extractComarcaFromOrgao(orgao, vara)
  const assuntos = (source.assuntos || [])
    .map((a) => a.nome || a.descricao || "")
    .filter(Boolean)
    .join("; ")
  const partes = source.partes || []
  const { isRuralProducer } = require("../../lib/enrichment")

  if (!partes.length) {
    const textoCapa = [assuntos, vara, source.objeto || source.assunto || ""].join(" ")
    const isExecClass = classe != null && CLASSES_SET.has(classe)
    if (!isExecClass && !isRuralProducer(textoCapa, null)) return null

    return {
      nome_reu: "Réu a identificar (capa Datajud)",
      cpf_cnpj: null,
      tipo_reu: "PF",
      numero_processo: String(source.numeroProcesso || "").replace(/\D/g, ""),
      numero_processo_formatado: source.numeroProcesso,
      tribunal: tribunalLabel,
      vara,
      comarca,
      valor_execucao: common.valor_causa,
      credor_exequente: null,
      data_ajuizamento: source.dataAjuizamento || null,
      tem_advogado: false,
      imoveis_rurais: [],
      nirf: null,
      car_numero: null,
      area_hectares: null,
      municipio_imovel: comarca,
      classe_codigo: common.classe_codigo,
      classe_nome: common.classe_nome,
      assuntos: assuntos || null,
      texto_rural: textoCapa,
      grau: common.grau,
      nivel_sigilo: common.nivel_sigilo,
      movimentos: common.movimentos,
      ultima_movimentacao: common.ultima_movimentacao,
      capa_datajud: true,
      dados_brutos: { datajud: source, tribunal: tribunalLabel },
    }
  }

  if (hasAdvogadoPassivo(source)) return null

  const reu = partes.find(isPoloPassivo) || partes[0]
  if (!reu) return null

  const nomeReu = String(reu.nome || "Réu não identificado").trim()
  const texto = [nomeReu, source.objeto || source.assunto || "", JSON.stringify(source.assuntos || [])].join(
    " ",
  )

  if (!isRuralProducer(texto, null)) return null

  const credor = partes.find((p) => !isPoloPassivo(p))

  return {
    nome_reu: nomeReu,
    cpf_cnpj: null,
    tipo_reu: /ltda|s\.?a|me\b|eireli|cnpj/i.test(nomeReu) ? "PJ" : "PF",
    numero_processo: String(source.numeroProcesso || "").replace(/\D/g, ""),
    numero_processo_formatado: source.numeroProcesso,
    tribunal: tribunalLabel,
    vara,
    comarca,
    valor_execucao: common.valor_causa,
    credor_exequente: credor?.nome || null,
    data_ajuizamento: source.dataAjuizamento || null,
    tem_advogado: false,
    imoveis_rurais: [],
    nirf: null,
    car_numero: null,
    area_hectares: null,
    municipio_imovel: comarca,
    classe_codigo: common.classe_codigo,
    classe_nome: common.classe_nome,
    assuntos: assuntos || null,
    texto_rural: texto,
    grau: common.grau,
    nivel_sigilo: common.nivel_sigilo,
    movimentos: common.movimentos,
    ultima_movimentacao: common.ultima_movimentacao,
    capa_datajud: false,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}

async function fetchExecucoesTribunal(alias, label, daysBack, size, apiKey) {
  const body = buildSearchBody({
    daysBack,
    size,
    classCodes: CLASSES_EXECUCAO,
  })

  const hits = await postSearch(endpoint(alias), body, apiKey, label)
  return hits.map((h) => parseHit(h, label)).filter(Boolean)
}

async function collectAllExecucoes() {
  const config = getConfig()
  if (!config.datajudApiKey) throw new Error("DATAJUD_API_KEY ausente")

  const results = []
  for (const t of TRIBUNAIS) {
    try {
      const rows = await fetchExecucoesTribunal(
        t.alias,
        t.label,
        config.execucoesDaysBack,
        config.collectPageSize,
        config.datajudApiKey,
      )
      results.push(...rows)
      console.log(`[execucoes] ${t.label}: ${rows.length} candidato(s)`)
    } catch (e) {
      console.error(`[execucoes] ${t.label}:`, e.message)
    }
  }
  return results
}

module.exports = { collectAllExecucoes, fetchExecucoesTribunal }
