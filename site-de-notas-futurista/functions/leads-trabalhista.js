const admin = require("firebase-admin")
const { computeLeadScore, outreachScheduleFromNow } = require("./lib/lead-scoring")

const MIN_SCORE_OUTREACH = 40
const MIN_SCORE_FCM = 70
const ADMIN_EMAIL = "cartoonhq@gmail.com"

function scheduleIso(daysFromNow) {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString()
}

async function queueOutreachForLead(db, leadId, leadData) {
  if ((leadData.score ?? 0) < MIN_SCORE_OUTREACH) return

  const existing = await db
    .collection("outreachQueue")
    .where("lead_id", "==", leadId)
    .where("tipo", "==", "automatico")
    .limit(1)
    .get()

  if (!existing.empty) return

  const batch = db.batch()
  const schedule = outreachScheduleFromNow()

  for (const entry of schedule) {
    const ref = db.collection("outreachQueue").doc()
    batch.set(ref, {
      lead_id: leadId,
      dia: entry.dia,
      tipo: "automatico",
      channels: ["whatsapp", "email"],
      status: "pending",
      scheduled_at: entry.scheduled_at,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
      updated_at: new Date().toISOString(),
    })
  }

  await batch.commit()
}

async function sendLeadFcm(db, leadId, leadData) {
  const usersSnap = await db
    .collection("users")
    .where("email", "==", ADMIN_EMAIL)
    .limit(1)
    .get()

  if (usersSnap.empty) {
    console.log("[leads] admin sem doc users — FCM ignorado")
    return
  }

  const userDoc = usersSnap.docs[0]
  const token = userDoc.data().fcmToken
  if (!token) {
    console.log("[leads] fcmToken ausente no perfil admin")
    return
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

  if (change.before.exists) {
    const prevScore = change.before.data().score ?? 0
    if (score >= MIN_SCORE_FCM && prevScore < MIN_SCORE_FCM) {
      await sendLeadFcm(db, leadId, merged).catch((err) =>
        console.error("[leads] FCM falhou", err),
      )
    }
    return null
  }

  // onCreate
  await queueOutreachForLead(db, leadId, merged)

  if (score >= MIN_SCORE_FCM) {
    await sendLeadFcm(db, leadId, merged).catch((err) =>
      console.error("[leads] FCM falhou", err),
    )
  }

  return null
}

/** Disparo manual do dashboard — garante scheduled_at imediato se ausente. */
async function handleManualOutreachQueue(snap) {
  const data = snap.data()
  if (data.tipo !== "manual") return null

  const patch = {}
  if (!data.scheduled_at) {
    patch.scheduled_at = scheduleIso(0)
  }
  if (!data.channels) {
    patch.channels = ["whatsapp", "email"]
  }
  if (Object.keys(patch).length > 0) {
    patch.updated_at = new Date().toISOString()
    await snap.ref.update(patch)
  }

  return null
}

module.exports = {
  scoreLeadOnWrite: handleLeadScoring,
  normalizeManualOutreach: handleManualOutreachQueue,
  MIN_SCORE_OUTREACH,
}
