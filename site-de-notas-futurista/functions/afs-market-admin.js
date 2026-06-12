const functions = require("firebase-functions")
const admin = require("firebase-admin")

const AFS_ADMIN_EMAILS = ["cartoonhq@gmail.com", "gabrieldouran@gmail.com"]

/** Define custom claim role=admin para usuários AFS autorizados (Bloco 11). */
exports.syncAfsAdminClaims = functions.https.onCall(async (_data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Faça login novamente.")
  }
  const email = String(context.auth.token.email || "").toLowerCase()
  if (!AFS_ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Sem permissão de admin AFS.")
  }
  await admin.auth().setCustomUserClaims(context.auth.uid, { role: "admin" })
  return { ok: true, role: "admin" }
})
