const { getDb } = require("../../lib/firestore")
const { loadModuleFilters, applyRegionalFilter, MODULE_KEYS } = require("../../lib/filters")
const { enrichContacts } = require("../../lib/enrichment")
const { collectAllExecucoes } = require("./datajud")

async function execucaoExists(numeroProcesso) {
  const db = getDb()
  const snap = await db
    .collection("execucoesRurais")
    .where("numero_processo", "==", numeroProcesso)
    .limit(1)
    .get()
  return !snap.empty
}

async function runCollectExecucoesRurais() {
  const db = getDb()
  const filters = await loadModuleFilters(db, MODULE_KEYS.execucoesRurais)
  let candidates = await collectAllExecucoes()
  candidates = applyRegionalFilter(candidates, filters)

  let novos = 0
  for (const c of candidates) {
    if (!c.numero_processo) continue
    if (await execucaoExists(c.numero_processo)) continue

    const enrichment = await enrichContacts({
      ...c,
      cnpj: c.cpf_cnpj,
      empresa: c.nome_reu,
    })

    const now = new Date().toISOString()
    await db.collection("execucoesRurais").add({
      nome_reu: c.nome_reu,
      cpf_cnpj: c.cpf_cnpj,
      tipo_reu: c.tipo_reu,
      numero_processo: c.numero_processo,
      numero_processo_formatado: c.numero_processo_formatado,
      processo: c.numero_processo_formatado || c.numero_processo,
      tribunal: c.tribunal,
      vara: c.vara,
      comarca: c.comarca,
      valor_execucao: c.valor_execucao,
      credor_exequente: c.credor_exequente,
      data_ajuizamento: c.data_ajuizamento,
      tem_advogado: c.tem_advogado,
      imoveis_rurais: c.imoveis_rurais,
      nirf: c.nirf,
      car_numero: c.car_numero,
      area_hectares: c.area_hectares,
      municipio_imovel: c.municipio_imovel,
      score: 0,
      score_motivo: null,
      status: "novo",
      contatos: enrichment.contatos,
      socio_nome: enrichment.socioNome,
      socio_qualificacao: enrichment.socioQualificacao,
      enriquecido_em: enrichment.enriquecidoEm,
      camada_maxima_atingida: enrichment.camadaMaximaAtingida,
      enriquecimento_parcial: enrichment.enriquecimento_parcial,
      created_at: now,
      updated_at: now,
      classe_codigo: c.classe_codigo,
    classe_nome: c.classe_nome,
    assuntos: c.assuntos,
    dados_brutos: c.dados_brutos,
    })
    novos += 1
    console.log(`[execucoes] novo: ${c.nome_reu} — ${c.numero_processo_formatado}`)
  }

  console.log(`[execucoes] fim — ${candidates.length} analisados, ${novos} novos`)
  return { analisados: candidates.length, novos }
}

module.exports = { runCollectExecucoesRurais }
