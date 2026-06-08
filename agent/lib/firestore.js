const admin = require("firebase-admin")

let db = null

function initFirestore() {
  if (db) return db
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.applicationDefault() })
  }
  db = admin.firestore()
  return db
}

module.exports = { initFirestore, getDb: () => db || initFirestore() }
