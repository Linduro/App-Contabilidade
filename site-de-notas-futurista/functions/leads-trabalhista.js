const admin = require("firebase-admin")
const { computeLeadScore } = require("./lib/lead-scoring")

const MIN_SCORE_FCM = 70
const ADMIN_EMAILS = ["cartoonhq@gmail.com", "gabrieldouran@gmail.com"]

async function sendLeadFcm(db, leadId, leadData) {
  for (const adminEmail of ADMIN_EMAILS) {
    const usersSnap = await db
      .collection("users")
      .where("email", "==", adminEmail)
      .limit(1)
      .get()

    if (usersSnap.empty) {
      console.log(`[leads] admin ${adminEmail} sem doc users — FCM ignorado`)
      continue
    }

    const userDoc = usersSnap.docs[0]
    const token = userDoc.data().fcmToken
    if (!token) {
      console.log(`[leads] fcmToken ausente no perfil ${adminEmail}`)
      continue
    }

    const title = "Lead trabalhista prioritário"
    const body = `${leadData.empresa} — score ${leadData.score} — ${leadData.vara || "TRT"}`

    await admin.messaging().send({
      token,
      notification: { title, body },
      data: {
        type: "trabalhista_lead",
        leadId,
        score: String(leadData.score ?? 0),
      },
    })
  }
}

async function handleLeadScoring(change, context) {
  const db = admin.firestore()
  const after = change.after.exists ? change.after.data() : null
  if (!after) return null

  const leadId = context.params.leadId
  const { score, score_motivo } = computeLeadScore(after)

  const patch = {}
  if (after.score !== score) patch.score = score
  if (after.score_motivo !== score_motivo) patch.score_motivo = score_motivo

  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString()
    await change.after.ref.update(patch)
  }

  const merged = { ...after, ...patch }
  const prevScore = change.before.exists ? (change.before.data().score ?? 0) : 0

  if (score >= MIN_SCORE_FCM && prevScore < MIN_SCORE_FCM) {
    await sendLeadFcm(db, leadId, merged).catch((err) =>
      console.error("[leads] FCM falhou", err),
    )
  }

  return null
}

module.exports = { scoreLeadOnWrite: handleLeadScoring }
