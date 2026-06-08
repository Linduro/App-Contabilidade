const { getDb } = require("../../lib/firestore")
const { collectAllTrts } = require("./datajud")
const { fetchCnpjData } = require("../shared/brasilapi")
const {
  leadExistsByProcesso,
  countLeadsByCnpj,
  createLead,
} = require("./firestore-leads")
const { loadModuleFilters, applyRegionalFilter, MODULE_KEYS } = require("../../lib/filters")
const { enrichContacts } = require("../../lib/enrichment")

async function runCollectTrabalhista() {
  console.log("[trabalhista] iniciando varredura Datajud…")
  const db = getDb()
  const filters = await loadModuleFilters(db, MODULE_KEYS.trabalhista)
  let candidates = await collectAllTrts()
  candidates = applyRegionalFilter(
    candidates.map((c) => ({ ...c, municipio: c.comarca })),
    filters,
  )

  let novos = 0
  let ignorados = 0

  for (const candidate of candidates) {
    if (await leadExistsByProcesso(candidate.numero_processo)) {
      ignorados += 1
      continue
    }

    let lead = { ...candidate }
    if (candidate.cnpj) {
      try {
        const cnpjData = await fetchCnpjData(candidate.cnpj)
        if (cnpjData) {
          lead = {
            ...lead,
            empresa: cnpjData.razao_social || lead.empresa,
            responsavel: cnpjData.responsavel,
            telefone: cnpjData.telefone,
            email: cnpjData.email,
            municipio: cnpjData.municipio || lead.comarca,
            uf: cnpjData.uf,
            site_url: cnpjData.site_url,
          }
        }
      } catch (e) {
        console.warn("[trabalhista] brasilapi:", e.message)
      }
    }

    lead.processos_simultaneos = candidate.cnpj
      ? await countLeadsByCnpj(candidate.cnpj)
      : 0

    const enrichment = await enrichContacts({
      ...lead,
      cnpj: candidate.cnpj,
    })

    const telefone =
      enrichment.contatos.telefone?.valor ||
      enrichment.contatos.whatsapp?.valor ||
      lead.telefone ||
      null
    const email = enrichment.contatos.email?.valor || lead.email || null

    await createLead({
      empresa: lead.empresa,
      cnpj: lead.cnpj,
      numero_processo: lead.numero_processo,
      numero_processo_formatado: lead.numero_processo_formatado,
      vara: lead.vara,
      comarca: lead.comarca,
      tribunal: lead.tribunal,
      valor_causa: lead.valor_causa,
      data_ajuizamento: lead.data_ajuizamento,
      ultima_movimentacao: lead.ultima_movimentacao,
      sem_movimentacao_posterior: lead.sem_movimentacao_posterior,
      setor: lead.setor,
      comarca_interior: lead.comarca_interior,
      responsavel: lead.responsavel || enrichment.socioNome || null,
      telefone,
      email,
      municipio: lead.municipio || null,
      uf: lead.uf || null,
      processos_simultaneos: lead.processos_simultaneos,
      status: "novo",
      score: 0,
      score_motivo: null,
      contatos: enrichment.contatos,
      socio_nome: enrichment.socioNome,
      socio_qualificacao: enrichment.socioQualificacao,
      enriquecido_em: enrichment.enriquecidoEm,
      camada_maxima_atingida: enrichment.camadaMaximaAtingida,
      enriquecimento_parcial: enrichment.enriquecimento_parcial,
      classe_codigo: lead.classe_codigo,
      classe_nome: lead.classe_nome,
      assuntos: lead.assuntos,
      dados_brutos: lead.dados_brutos,
    })

    novos += 1
    console.log(`[trabalhista] novo: ${lead.empresa}`)
  }

  console.log(
    `[trabalhista] fim — ${candidates.length} analisados, ${novos} novos, ${ignorados} existentes`,
  )
}

module.exports = { runCollectTrabalhista }
