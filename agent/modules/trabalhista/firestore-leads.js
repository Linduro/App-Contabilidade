const { getDb } = require("../../lib/firestore")

async function leadExistsByProcesso(numeroProcesso) {
  const snap = await getDb()
    .collection("leads")
    .where("numero_processo", "==", numeroProcesso)
    .limit(1)
    .get()
  return !snap.empty
}

async function countLeadsByCnpj(cnpj) {
  const snap = await getDb().collection("leads").where("cnpj", "==", cnpj).get()
  return snap.size
}

async function createLead(data) {
  const now = new Date().toISOString()
  const ref = await getDb()
    .collection("leads")
    .add({ ...data, created_at: now, updated_at: now })
  return ref.id
}

async function getLead(leadId) {
  const snap = await getDb().collection("leads").doc(leadId).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

async function updateLead(leadId, patch) {
  await getDb()
    .collection("leads")
    .doc(leadId)
    .update({ ...patch, updated_at: new Date().toISOString() })
}

module.exports = {
  leadExistsByProcesso,
  countLeadsByCnpj,
  createLead,
  getLead,
  updateLead,
}
