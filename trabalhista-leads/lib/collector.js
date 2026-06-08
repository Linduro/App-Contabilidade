const { collectAllTrts } = require("./datajud")
const { fetchCnpjData } = require("./brasilapi")
const {
  leadExistsByProcesso,
  countLeadsByCnpj,
  createLead,
} = require("./firestore")

async function enrichLead(candidate) {
  let enriched = { ...candidate }

  if (candidate.cnpj) {
    try {
      const cnpjData = await fetchCnpjData(candidate.cnpj)
      if (cnpjData) {
        enriched = {
          ...enriched,
          empresa: cnpjData.razao_social || enriched.empresa,
          responsavel: cnpjData.responsavel,
          telefone: cnpjData.telefone,
          email: cnpjData.email,
          municipio: cnpjData.municipio,
          uf: cnpjData.uf,
          cnae_fiscal: cnpjData.cnae_fiscal,
          qsa_bruto: cnpjData.dados_brutos?.qsa || null,
        }
      }
    } catch (error) {
      console.warn(`[brasilapi] CNPJ ${candidate.cnpj}:`, error.message)
    }
  }

  if (candidate.cnpj) {
    enriched.processos_simultaneos = await countLeadsByCnpj(candidate.cnpj)
  } else {
    enriched.processos_simultaneos = 0
  }

  return enriched
}

async function runCollect() {
  console.log("[collect] iniciando varredura Datajud…")
  const candidates = await collectAllTrts()
  let novos = 0
  let ignorados = 0

  for (const candidate of candidates) {
    const exists = await leadExistsByProcesso(candidate.numero_processo)
    if (exists) {
      ignorados += 1
      continue
    }

    const lead = await enrichLead(candidate)
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
      responsavel: lead.responsavel || null,
      telefone: lead.telefone || null,
      email: lead.email || null,
      municipio: lead.municipio || null,
      uf: lead.uf || null,
      processos_simultaneos: lead.processos_simultaneos,
      status: "novo",
      score: 0,
      score_motivo: null,
      dados_brutos: lead.dados_brutos,
    })
    novos += 1
    console.log(`[collect] novo lead: ${lead.empresa} — ${lead.numero_processo_formatado}`)
  }

  console.log(
    `[collect] fim — ${candidates.length} analisados, ${novos} novos, ${ignorados} já existentes`,
  )
  return { analisados: candidates.length, novos, ignorados }
}

module.exports = { runCollect, enrichLead }
