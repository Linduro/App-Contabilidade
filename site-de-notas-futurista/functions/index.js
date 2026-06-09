const admin = require("firebase-admin")
const functions = require("firebase-functions")
const nodemailer = require("nodemailer")
const twilio = require("twilio")
const {
  scoreLeadOnWrite,
} = require("./leads-trabalhista")
const { scoreExecucaoRuralOnWrite } = require("./execucoes-rurais-scoring")
const { scoreExecucaoAltoValorOnWrite } = require("./execucoes-alto-valor-scoring")
const { datajudSearch } = require("./datajud-proxy")

admin.initializeApp()

function getMailTransport() {
  const user = process.env.SMTP_USER || functions.config().smtp?.user
  const pass = process.env.SMTP_PASS || functions.config().smtp?.pass

  if (!user || !pass) return null

  return nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  })
}

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID || functions.config().twilio?.sid
  const token = process.env.TWILIO_AUTH_TOKEN || functions.config().twilio?.token
  const from = process.env.TWILIO_FROM || functions.config().twilio?.from

  if (!sid || !token || !from) return null

  return {
    client: twilio(sid, token),
    from,
  }
}

async function sendEmail(to, subject, customSubject) {
  const transport = getMailTransport()
  if (!transport) {
    console.warn("SMTP não configurado — e-mail não enviado para", to)
    return false
  }

  await transport.sendMail({
    from: process.env.SMTP_USER || functions.config().smtp?.user,
    to,
    subject: customSubject || "Lembrete — App Contabilidade",
    text: subject,
  })

  return true
}

async function sendSms(to, body) {
  const twilioConfig = getTwilioClient()
  if (!twilioConfig) {
    console.warn("Twilio não configurado — SMS não enviado para", to)
    return false
  }

  await twilioConfig.client.messages.create({
    from: twilioConfig.from,
    to,
    body,
  })

  return true
}

exports.processNotificationQueue = functions.firestore
  .document("notificationQueue/{notificationId}")
  .onCreate(async (snap) => {
    const data = snap.data()
    const ref = snap.ref

    try {
      let sent = false

      if (data.channel === "email") {
        sent = await sendEmail(data.to, data.title, data.subject)
      } else if (data.channel === "sms") {
        sent = await sendSms(data.to, data.title)
      }

      await ref.update({
        status: sent ? "sent" : "skipped",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    } catch (error) {
      console.error("Falha ao enviar notificação", error)
      await ref.update({
        status: "failed",
        error: String(error),
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }
  })

exports.dailyReminderScan = functions.pubsub
  .schedule("every day 08:00")
  .timeZone("America/Sao_Paulo")
  .onRun(async () => {
    const db = admin.firestore()
    const today = new Date().toISOString().slice(0, 10)
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)
    const usersSnap = await db.collection("users").get()

    for (const userDoc of usersSnap.docs) {
      const profile = userDoc.data()
      const progressionSnap = await userDoc.ref.collection("progression").doc("main").get()
      if (!progressionSnap.exists) continue

      const reminders = progressionSnap.data().reminders || []
      const email = profile.email || ""
      const phone = profile.phone || ""
      const allowEmail = profile.notifyEmail !== false
      const allowSms = profile.notifySms === true && !!phone

      for (const reminder of reminders) {
        if (reminder.done) continue
        if (reminder.date !== today && reminder.date !== tomorrow) continue

        const title = (reminder.title || "Lembrete de prazo").trim()
        const when = reminder.date === today ? "hoje" : "amanhã"
        const body = `${title} — ${when} (${reminder.date})`

        if (reminder.notifyEmail !== false && allowEmail && email) {
          await db.collection("notificationQueue").add({
            userId: userDoc.id,
            reminderId: reminder.id,
            channel: "email",
            to: email,
            title: body,
            date: reminder.date,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "daily-scan",
          })
        }

        if (reminder.notifySms && allowSms) {
          await db.collection("notificationQueue").add({
            userId: userDoc.id,
            reminderId: reminder.id,
            channel: "sms",
            to: phone,
            title: body,
            date: reminder.date,
            status: "pending",
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            source: "daily-scan",
          })
        }
      }
    }

    return null
  })

exports.scoreLeadOnWrite = functions.firestore
  .document("leads/{leadId}")
  .onWrite(scoreLeadOnWrite)

exports.scoreExecucaoRuralOnWrite = functions.firestore
  .document("execucoesRurais/{execucaoId}")
  .onWrite(scoreExecucaoRuralOnWrite)

exports.scoreExecucaoAltoValorOnWrite = functions.firestore
  .document("execucoesAltoValor/{docId}")
  .onWrite(scoreExecucaoAltoValorOnWrite)

exports.datajudSearch = datajudSearch
