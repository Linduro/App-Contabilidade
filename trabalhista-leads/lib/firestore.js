const admin = require("firebase-admin")

let db = null

function initFirestore() {
  if (db) return db

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    })
  }

  db = admin.firestore()
  return db
}

function leadsCol() {
  return initFirestore().collection("leads")
}

function outreachQueueCol() {
  return initFirestore().collection("outreachQueue")
}

function outreachLogCol() {
  return initFirestore().collection("outreachLog")
}

async function leadExistsByProcesso(numeroProcesso) {
  const snap = await leadsCol()
    .where("numero_processo", "==", numeroProcesso)
    .limit(1)
    .get()
  return !snap.empty
}

async function countLeadsByCnpj(cnpj) {
  const snap = await leadsCol().where("cnpj", "==", cnpj).get()
  return snap.size
}

async function createLead(data) {
  const now = new Date().toISOString()
  const ref = await leadsCol().add({
    ...data,
    score: data.score ?? 0,
    status: data.status ?? "novo",
    created_at: now,
    updated_at: now,
  })
  return ref.id
}

async function getPendingOutreach(limit = 20) {
  const now = new Date().toISOString()
  const snap = await outreachQueueCol()
    .where("status", "==", "pending")
    .where("scheduled_at", "<=", now)
    .orderBy("scheduled_at")
    .limit(limit)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

async function updateOutreachQueue(id, patch) {
  await outreachQueueCol().doc(id).update({
    ...patch,
    updated_at: new Date().toISOString(),
  })
}

async function appendOutreachLog(entry) {
  await outreachLogCol().add({
    ...entry,
    created_at: new Date().toISOString(),
  })
}

async function getLead(leadId) {
  const snap = await leadsCol().doc(leadId).get()
  if (!snap.exists) return null
  return { id: snap.id, ...snap.data() }
}

async function updateLead(leadId, patch) {
  await leadsCol()
    .doc(leadId)
    .update({ ...patch, updated_at: new Date().toISOString() })
}

module.exports = {
  initFirestore,
  leadsCol,
  outreachQueueCol,
  outreachLogCol,
  leadExistsByProcesso,
  countLeadsByCnpj,
  createLead,
  getPendingOutreach,
  updateOutreachQueue,
  appendOutreachLog,
  getLead,
  updateLead,
}
