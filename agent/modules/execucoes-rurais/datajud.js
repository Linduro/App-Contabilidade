const { getConfig } = require("../../lib/config-loader")

const BASE = "https://api-publica.datajud.cnj.jus.br"
const CLASSES_EXECUCAO = new Set([1116, 877, 40, "1116", "877", "40"])

const TRIBUNAIS = [
  { alias: "tjsp", label: "TJSP" },
  { alias: "trf3", label: "TRF3" },
]

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function endpoint(alias) {
  return `${BASE}/api_publica_${alias}/_search`
}

function extractClasse(source) {
  const c = source.classe || source.classeProcessual || {}
  return c.codigo ?? c.code ?? c.numero ?? null
}

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
  const classe = extractClasse(source)
  if (classe != null && !CLASSES_EXECUCAO.has(classe)) return null
  if (hasAdvogadoPassivo(source)) return null

  const partes = source.partes || []
  const reu = partes.find(isPoloPassivo) || partes[0]
  if (!reu) return null

  const nomeReu = String(reu.nome || "Réu não identificado").trim()
  const texto = [nomeReu, source.objeto || source.assunto || "", JSON.stringify(source.assuntos || [])].join(" ")

  const { isRuralProducer } = require("../../lib/enrichment")
  if (!isRuralProducer(texto, null)) return null

  const orgao = source.orgaoJulgador || {}
  const valor = parseFloat(source.valorCausa || source.valor || 0) || 0

  const credor = partes.find((p) => !isPoloPassivo(p))

  return {
    nome_reu: nomeReu,
    cpf_cnpj: null,
    tipo_reu: /ltda|s\.?a|me\b|eireli|cnpj/i.test(nomeReu) ? "PJ" : "PF",
    numero_processo: String(source.numeroProcesso || "").replace(/\D/g, ""),
    numero_processo_formatado: source.numeroProcesso,
    tribunal: tribunalLabel,
    vara: orgao.nome || orgao.nomeOrgao || tribunalLabel,
    comarca: orgao.municipioNome || orgao.nomeMunicipio || null,
    valor_execucao: valor,
    credor_exequente: credor?.nome || null,
    data_ajuizamento: source.dataAjuizamento || null,
    tem_advogado: false,
    imoveis_rurais: [],
    nirf: null,
    car_numero: null,
    area_hectares: null,
    municipio_imovel: orgao.municipioNome || null,
    texto_rural: texto,
    dados_brutos: { datajud: source, tribunal: tribunalLabel },
  }
}

async function fetchExecucoesTribunal(alias, label, daysBack, size) {
  const config = getConfig()
  if (!config.datajudApiKey) throw new Error("datajud_api_key ausente")

  const body = {
    size,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [{ range: { dataAjuizamento: { gte: daysAgoIso(daysBack) } } }],
      },
    },
  }

  const response = await fetch(endpoint(alias), {
    method: "POST",
    headers: {
      Authorization: `APIKey ${config.datajudApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const t = await response.text()
    throw new Error(`${label} HTTP ${response.status}: ${t.slice(0, 150)}`)
  }

  const payload = await response.json()
  return (payload.hits?.hits ?? []).map((h) => parseHit(h, label)).filter(Boolean)
}

async function collectAllExecucoes() {
  const config = getConfig()
  const results = []
  for (const t of TRIBUNAIS) {
    try {
      const rows = await fetchExecucoesTribunal(
        t.alias,
        t.label,
        config.execucoesDaysBack,
        config.collectPageSize,
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
