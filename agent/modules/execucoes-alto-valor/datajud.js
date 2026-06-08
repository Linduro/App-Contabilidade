const ALTO_VALOR_MIN = 500_000
const CLASSES = new Set([877, 1116, 40])

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

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function extractClasse(source) {
  const c = source.classe || source.classeProcessual || {}
  const codigo = c.codigo ?? c.code ?? c.numero ?? null
  return codigo != null ? Number(codigo) : null
}

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

function parseHit(source, tribunalLabel) {
  const classe = extractClasse(source)
  if (classe == null || !CLASSES.has(classe)) return null

  const valor = parseFloat(source.valorCausa || source.valor || 0)
  if (!Number.isFinite(valor) || valor < ALTO_VALOR_MIN) return null

  const partes = source.partes || []
  const executadoParte = partes.find(isPoloPassivo)
  if (!executadoParte || !semAdvogado(executadoParte)) return null

  for (const p of partes) {
    if (isPoloPassivo(p) && !semAdvogado(p)) return null
  }

  const exequenteParte = partes.find((p) => !isPoloPassivo(p))
  const executado = String(executadoParte.nome || "Executado não identificado").trim()
  const cnpjCpf = extractDoc(executadoParte) || ""
  const orgao = source.orgaoJulgador || {}
  const numeroProcesso = String(source.numeroProcesso || "").replace(/\D/g, "")

  return {
    numeroProcesso,
    processo: String(source.numeroProcesso || numeroProcesso),
    tribunal: tribunalLabel,
    vara: orgao.nome || orgao.nomeOrgao || tribunalLabel,
    comarca: orgao.municipioNome || orgao.nomeMunicipio || orgao.nome || "—",
    valorCausa: valor,
    exequente: exequenteParte?.nome || null,
    executado,
    cnpjCpf,
    tipoExecutado: cnpjCpf.length === 14 || /ltda|s\.?a|me\b|eireli/i.test(executado) ? "PJ" : "PF",
    dataAjuizamento: source.dataAjuizamento || null,
    ultimoMovimento:
      source.dataUltimaAtualizacao ||
      source.dataHoraUltimaAtualizacao ||
      source.dataAjuizamento ||
      null,
    temAdvogado: false,
    comarcaInterior: true,
    cnaeRural: false,
    dadosBrutos: source,
  }
}

async function fetchTribunal(alias, label, daysBack, size, apiKey) {
  const body = {
    size,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [
          { range: { dataAjuizamento: { gte: daysAgoIso(daysBack) } } },
          { range: { valorCausa: { gte: ALTO_VALOR_MIN } } },
          {
            bool: {
              should: [
                { terms: { "classe.codigo": [877, 1116, 40] } },
                { terms: { "classeProcessual.codigo": [877, 1116, 40] } },
              ],
              minimum_should_match: 1,
            },
          },
        ],
      },
    },
  }

  const url = `https://api-publica.datajud.cnj.jus.br/api_publica_${alias}/_search`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `APIKey ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const t = await response.text()
    throw new Error(`${label} HTTP ${response.status}: ${t.slice(0, 150)}`)
  }

  const payload = await response.json()
  return (payload.hits?.hits ?? [])
    .map((h) => parseHit(h._source || {}, label))
    .filter(Boolean)
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
