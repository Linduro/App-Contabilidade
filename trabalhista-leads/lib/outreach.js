const { getConfig } = require("./config-loader")

function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "")
}

async function sendWhatsApp(phone, text) {
  const config = getConfig()
  if (!config.evolutionApiUrl || !config.evolutionApiKey) {
    console.warn("[evolution] não configurado — WhatsApp ignorado")
    return false
  }

  const number = String(phone).replace(/\D/g, "")
  if (number.length < 10) return false

  const url = `${config.evolutionApiUrl}/message/sendText/${config.evolutionInstance}`
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: config.evolutionApiKey,
    },
    body: JSON.stringify({ number, text }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Evolution API ${response.status}: ${body.slice(0, 200)}`)
  }

  return true
}

function getMailTransport() {
  const config = getConfig()
  const { smtp } = config
  if (!smtp.user || !smtp.pass) return null

  const nodemailer = require("nodemailer")
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
    auth: { user: smtp.user, pass: smtp.pass },
  })
}

async function sendEmail(to, subject, text) {
  const config = getConfig()
  const transport = getMailTransport()
  if (!transport) {
    console.warn("[email] SMTP não configurado — e-mail ignorado")
    return false
  }

  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject,
    text,
  })
  return true
}

function buildMessageVars(lead) {
  const valor = lead.valor_causa
    ? lead.valor_causa.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })
    : "não informado"

  return {
    empresa: lead.empresa || "sua empresa",
    responsavel: lead.responsavel || "responsável",
    processo: lead.numero_processo_formatado || lead.numero_processo,
    vara: lead.vara || "Justiça do Trabalho",
    valor,
  }
}

module.exports = {
  fillTemplate,
  sendWhatsApp,
  sendEmail,
  buildMessageVars,
}
