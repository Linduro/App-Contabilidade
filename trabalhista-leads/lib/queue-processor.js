const { getConfig } = require("./config-loader")
const {
  sendWhatsApp,
  sendEmail,
  fillTemplate,
  buildMessageVars,
} = require("./outreach")
const {
  getPendingOutreach,
  updateOutreachQueue,
  appendOutreachLog,
  getLead,
  updateLead,
} = require("./firestore")

async function processOutreachItem(item) {
  const config = getConfig()
  const lead = await getLead(item.lead_id)
  if (!lead) {
    await updateOutreachQueue(item.id, {
      status: "failed",
      error: "Lead não encontrado",
    })
    return
  }

  if ((lead.score ?? 0) < config.minScoreForOutreach && item.tipo !== "manual") {
    await updateOutreachQueue(item.id, {
      status: "skipped",
      error: `Score ${lead.score} abaixo do mínimo`,
    })
    return
  }

  const vars = buildMessageVars(lead)
  const whatsappText = fillTemplate(config.whatsappTemplate, vars)
  const emailSubject = fillTemplate(config.emailSubject, vars)
  const emailText = fillTemplate(config.emailTemplate, vars)

  const channels = item.channels || ["whatsapp", "email"]
  const results = {}

  try {
    if (channels.includes("whatsapp") && lead.telefone) {
      results.whatsapp = await sendWhatsApp(lead.telefone, whatsappText)
    }
    if (channels.includes("email") && lead.email) {
      results.email = await sendEmail(lead.email, emailSubject, emailText)
    }

    const anySent = Object.values(results).some(Boolean)
    const status = anySent ? "sent" : "skipped"

    await updateOutreachQueue(item.id, {
      status,
      sent_at: new Date().toISOString(),
      results,
    })

    await appendOutreachLog({
      lead_id: item.lead_id,
      queue_id: item.id,
      dia: item.dia ?? null,
      tipo: item.tipo || "automatico",
      channels,
      results,
      empresa: lead.empresa,
      processo: lead.numero_processo_formatado || lead.numero_processo,
      telefone: lead.telefone || null,
      email: lead.email || null,
    })

    if (anySent && lead.status === "novo") {
      await updateLead(item.lead_id, { status: "contatado" })
    }
  } catch (error) {
    await updateOutreachQueue(item.id, {
      status: "failed",
      error: String(error.message || error),
    })
    throw error
  }
}

async function runOutreach() {
  const pending = await getPendingOutreach()
  if (pending.length === 0) {
    console.log("[outreach] fila vazia")
    return { processados: 0 }
  }

  let processados = 0
  for (const item of pending) {
    try {
      await processOutreachItem(item)
      processados += 1
      console.log(`[outreach] lead ${item.lead_id} dia ${item.dia} — ok`)
    } catch (error) {
      console.error(`[outreach] falha ${item.id}:`, error.message)
    }
  }

  return { processados }
}

module.exports = { runOutreach, processOutreachItem }
