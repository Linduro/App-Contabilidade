const { getConfig } = require("../../lib/config-loader")

const BASE = "https://api-publica.datajud.cnj.jus.br"

function trtEndpoint(trt) {
  return `${BASE}/api_publica_trt${trt}/_search`
}

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

async function fetchRecentLaborCases(trt, daysBack = 7, size = 50) {
  const config = getConfig()
  if (!config.datajudApiKey) {
    throw new Error("DATAJUD_API_KEY não configurada.")
  }

  const body = {
    size,
    sort: [{ dataAjuizamento: { order: "desc" } }],
    query: {
      bool: {
        must: [{ range: { dataAjuizamento: { gte: daysAgoIso(daysBack) } } }],
      },
    },
  }

  const response = await fetch(trtEndpoint(trt), {
    method: "POST",
    headers: {
      Authorization: `APIKey ${config.datajudApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Datajud TRT${trt} HTTP ${response.status}: ${text.slice(0, 200)}`)
  }

  const payload = await response.json()
  return (payload.hits?.hits ?? []).map((hit) => parseDatajudHit(hit, trt)).filter(Boolean)
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
  if (!numeroProcesso || hasAdvogadoConstituido(source)) return null

  const partes = source.partes || source.dadosBasicos?.partes || []
  const reusPj = partes.filter((p) => isPoloPassivo(p) && isPessoaJuridica(p))
  if (!reusPj.length) return null

  const reu = reusPj[0]
  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || `TRT-${trt}`
  const comarca = orgao.municipioNome || orgao.nomeMunicipio || vara
  const assuntos = (source.assuntos || []).map((a) => a.nome || a.descricao || "").join(" ")
  const empresa = String(reu.nome || "Empresa não identificada").trim()
  const classe = source.classe || source.classeProcessual || {}
  const classe_codigo = classe.codigo ?? classe.code ?? null
  const classe_nome = classe.nome || classe.descricao || null

  return {
    numero_processo: numeroProcesso,
    numero_processo_formatado: source.numeroProcesso || numeroProcesso,
    empresa,
    cnpj: extractCnpjFromParte(reu),
    vara,
    comarca,
    tribunal: `TRT-${trt}`,
    valor_causa: parseFloat(source.valorCausa || source.valor || 0) || 0,
    data_ajuizamento: source.dataAjuizamento || source.dataHoraAjuizamento || null,
    ultima_movimentacao: null,
    sem_movimentacao_posterior: true,
    setor: /agro|fazenda|pecu/i.test(`${empresa} ${assuntos}`) ? "agro" : "outros",
    comarca_interior: true,
    classe_codigo: classe_codigo != null ? Number(classe_codigo) : null,
    classe_nome: classe_nome ? String(classe_nome) : null,
    assuntos: assuntos || null,
    dados_brutos: { datajud: source, trt },
  }
}

async function collectAllTrts() {
  const config = getConfig()
  const results = []
  for (const trt of config.datajudTrts) {
    try {
      const cases = await fetchRecentLaborCases(trt, config.collectDaysBack, config.collectPageSize)
      results.push(...cases)
      console.log(`[datajud] TRT-${trt}: ${cases.length} candidato(s)`)
    } catch (error) {
      console.error(`[datajud] TRT-${trt} falhou:`, error.message)
    }
  }
  return results
}

module.exports = { collectAllTrts }
