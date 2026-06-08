const { matchesRegionalFilter } = require("../config/regioes")

const MODULE_KEYS = {
  licitacoes: "licitacoes",
  trabalhista: "trabalhista",
  execucoesRurais: "execucoesRurais",
}

async function resolveFilterUserId(db) {
  const workerSnap = await db.collection("systemConfig").doc("worker").get()
  if (workerSnap.exists && workerSnap.data().filter_user_id) {
    return workerSnap.data().filter_user_id
  }

  const ownerSnap = await db.collection("licitacoesConfig").doc("owner").get()
  const email = ownerSnap.exists ? ownerSnap.data().email : null
  if (!email) return null

  const usersSnap = await db.collection("users").where("email", "==", email).limit(1).get()
  if (usersSnap.empty) return null
  return usersSnap.docs[0].id
}

async function loadModuleFilters(db, moduleKey) {
  const userId = await resolveFilterUserId(db)
  if (!userId) {
    return { regioes: [], cidades: [] }
  }

  const snap = await db
    .collection("userSettings")
    .doc(userId)
    .collection("filters")
    .doc(moduleKey)
    .get()

  if (!snap.exists) {
    return { regioes: [], cidades: [] }
  }

  const data = snap.data()
  return {
    regioes: Array.isArray(data.regioes) ? data.regioes : [],
    cidades: Array.isArray(data.cidades) ? data.cidades : [],
  }
}

function applyRegionalFilter(records, filter) {
  if (!filter.regioes?.length && !filter.cidades?.length) {
    return records
  }
  return records.filter((r) => matchesRegionalFilter(r, filter))
}

module.exports = {
  MODULE_KEYS,
  resolveFilterUserId,
  loadModuleFilters,
  applyRegionalFilter,
  matchesRegionalFilter,
}
