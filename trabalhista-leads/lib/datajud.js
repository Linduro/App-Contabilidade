const { getConfig } = require("./config-loader")

const BASE = "https://api-publica.datajud.cnj.jus.br"

function trtEndpoint(trt) {
  return `${BASE}/api_publica_trt${trt}/_search`
}

function daysAgoIso(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/**
 * Busca processos trabalhistas recentes no Datajud.
 * Filtra no cliente: réu PJ sem advogado constituído no polo passivo.
 */
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
        must: [
          {
            range: {
              dataAjuizamento: {
                gte: daysAgoIso(daysBack),
              },
            },
          },
        ],
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
  const hits = payload.hits?.hits ?? []

  return hits
    .map((hit) => parseDatajudHit(hit, trt))
    .filter(Boolean)
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
  const nome = String(parte.nome || "")
  const match = nome.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/)
  if (match) return match[0].replace(/\D/g, "")
  return null
}

function isPessoaJuridica(parte) {
  const tipo = String(parte.tipoPessoa || parte.tipo || "").toUpperCase()
  if (tipo.includes("JUR") || tipo === "PJ") return true
  const cnpj = extractCnpjFromParte(parte)
  return Boolean(cnpj)
}

function isPoloPassivo(parte) {
  const polo = String(parte.polo || parte.tipoParticipacao || "").toUpperCase()
  return polo.includes("PASSIV") || polo.includes("RÉU") || polo.includes("REU")
}

function hasAdvogadoConstituido(source) {
  const advogados = source.advogados || source.representantes || []
  if (Array.isArray(advogados) && advogados.length > 0) return true

  const partes = source.partes || source.dadosBasicos?.partes || []
  for (const parte of partes) {
    if (!isPoloPassivo(parte)) continue
    const reps = parte.advogados || parte.representantes || []
    if (Array.isArray(reps) && reps.length > 0) return true
  }
  return false
}

function parseDatajudHit(hit, trt) {
  const source = hit._source || hit.source || {}
  const numeroProcesso = normalizeProcesso(source.numeroProcesso)
  if (!numeroProcesso) return null

  if (hasAdvogadoConstituido(source)) return null

  const partes = source.partes || source.dadosBasicos?.partes || []
  const reusPj = partes.filter((p) => isPoloPassivo(p) && isPessoaJuridica(p))
  if (reusPj.length === 0) return null

  const reu = reusPj[0]
  const cnpj = extractCnpjFromParte(reu)
  const empresa = String(reu.nome || source.nomeParte || "Empresa não identificada").trim()

  const orgao = source.orgaoJulgador || {}
  const vara = orgao.nome || orgao.nomeOrgao || `TRT-${trt}`
  const comarca = orgao.municipioNome || orgao.nomeMunicipio || vara

  const movimentos = source.movimentos || source.movimentacao || []
  const ultimaMovimentacao =
    movimentos.length > 0
      ? movimentos[movimentos.length - 1]?.dataHora ||
        movimentos[movimentos.length - 1]?.data
      : null

  const valorCausa = parseFloat(source.valorCausa || source.valor || 0) || 0
  const dataAjuizamento = source.dataAjuizamento || source.dataHoraAjuizamento || null

  const assuntos = (source.assuntos || [])
    .map((a) => a.nome || a.descricao || "")
    .join(" ")
  const setor = inferSetor(empresa, assuntos)

  return {
    numero_processo: numeroProcesso,
    numero_processo_formatado: source.numeroProcesso || numeroProcesso,
    empresa,
    cnpj,
    vara,
    comarca,
    tribunal: `TRT-${trt}`,
    valor_causa: valorCausa,
    data_ajuizamento: dataAjuizamento,
    ultima_movimentacao: ultimaMovimentacao,
    sem_movimentacao_posterior: !ultimaMovimentacao,
    setor,
    comarca_interior: isComarcaInterior(comarca, vara),
    dados_brutos: { datajud: source, trt },
  }
}

function inferSetor(empresa, assuntos) {
  const text = `${empresa} ${assuntos}`.toLowerCase()
  if (/agro|agric|pecu|fazenda| rural/.test(text)) return "agro"
  if (/constru|engenh|obra|incorpor| cimento| pedreiro/.test(text)) return "construcao"
  return "outros"
}

function isComarcaInterior(comarca, vara) {
  const text = `${comarca} ${vara}`.toLowerCase()
  const capitais = [
    "sao paulo",
    "rio de janeiro",
    "belo horizonte",
    "curitiba",
    "porto alegre",
    "salvador",
    "recife",
    "fortaleza",
    "brasilia",
    "manaus",
  ]
  if (capitais.some((c) => text.includes(c))) return false
  return /comarca|interior|var[aá] do|juizado/.test(text) || text.length > 0
}

async function collectAllTrts() {
  const config = getConfig()
  const results = []
  for (const trt of config.datajudTrts) {
    try {
      const cases = await fetchRecentLaborCases(
        trt,
        config.collectDaysBack,
        config.collectPageSize,
      )
      results.push(...cases)
      console.log(`[datajud] TRT-${trt}: ${cases.length} candidato(s)`)
    } catch (error) {
      console.error(`[datajud] TRT-${trt} falhou:`, error.message)
    }
  }
  return results
}

module.exports = {
  fetchRecentLaborCases,
  collectAllTrts,
  normalizeProcesso,
}
