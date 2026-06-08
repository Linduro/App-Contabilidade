const { getDb } = require("../../lib/firestore")
const { loadModuleFilters, applyRegionalFilter, MODULE_KEYS } = require("../../lib/filters")
const { enrichContacts } = require("../../lib/enrichment")
const { collectAllAltoValor } = require("./datajud")
const { fetchCnpjData } = require("../shared/brasilapi")

const CNAES_RURAL = ["0111", "0112", "0113", "0121", "0122", "0131", "0141", "0151", "0152", "0161"]

function isCnaeRural(cnae) {
  const c = String(cnae || "").replace(/\D/g, "").slice(0, 4)
  return CNAES_RURAL.some((p) => c.startsWith(p))
}

async function exists(numeroProcesso) {
  const snap = await getDb()
    .collection("execucoesAltoValor")
    .where("numeroProcesso", "==", numeroProcesso)
    .limit(1)
    .get()
  return !snap.empty
}

async function runCollectExecucoesAltoValor() {
  const db = getDb()
  const filters = await loadModuleFilters(db, MODULE_KEYS.execucoesAltoValor)
  let candidates = await collectAllAltoValor()
  candidates = applyRegionalFilter(
    candidates.map((c) => ({ ...c, municipio: c.comarca })),
    filters,
  )

  let novos = 0
  for (const c of candidates) {
    if (!c.numeroProcesso) continue
    if (await exists(c.numeroProcesso)) continue

    let cnaeRural = false
    if (c.tipoExecutado === "PJ" && c.cnpjCpf) {
      try {
        const data = await fetchCnpjData(c.cnpjCpf)
        if (data?.cnae_fiscal) cnaeRural = isCnaeRural(data.cnae_fiscal)
      } catch (e) {
        console.warn("[alto-valor] brasilapi:", e.message)
      }
    }

    const enrichment = await enrichContacts({
      cnpj: c.cnpjCpf,
      empresa: c.executado,
      nome_reu: c.executado,
    })

    const now = new Date().toISOString()
    await db.collection("execucoesAltoValor").add({
      numeroProcesso: c.numeroProcesso,
      processo: c.processo,
      tribunal: c.tribunal,
      vara: c.vara,
      comarca: c.comarca,
      valorCausa: c.valorCausa,
      exequente: c.exequente,
      executado: c.executado,
      cnpjCpf: c.cnpjCpf,
      tipoExecutado: c.tipoExecutado,
      dataAjuizamento: c.dataAjuizamento,
      ultimoMovimento: c.ultimoMovimento,
      temAdvogado: false,
      cnaeRural,
      comarcaInterior: c.comarcaInterior,
      contatos: enrichment.contatos,
      enriquecimentoParcial: enrichment.enriquecimento_parcial,
      score: 0,
      scoreMotivo: null,
      status: "novo",
      criadoEm: now,
      atualizadoEm: now,
    })
    novos += 1
    console.log(`[alto-valor] novo: ${c.executado} — R$ ${c.valorCausa}`)
  }

  console.log(`[alto-valor] fim — ${candidates.length} analisados, ${novos} novos`)
  return { analisados: candidates.length, novos }
}

module.exports = { runCollectExecucoesAltoValor }
