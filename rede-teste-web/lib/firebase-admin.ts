import admin from "firebase-admin"

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app()

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (json) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(json) as admin.ServiceAccount),
    })
    return admin.app()
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || "contabilidade-ebed6",
  })
  return admin.app()
}

export function getFirebaseAdminAuth() {
  initFirebaseAdmin()
  return admin.auth()
}
