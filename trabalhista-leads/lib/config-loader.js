require("dotenv").config()

const DEFAULT_SETTINGS = {
  enabled: false,
  collect_enabled: true,
  outreach_enabled: true,
  datajud_api_key: "",
  datajud_trts: "1,2,3,15",
  datajud_days_back: 7,
  datajud_page_size: 50,
  evolution_api_url: "",
  evolution_api_key: "",
  evolution_instance: "default",
  smtp_host: "smtp.gmail.com",
  smtp_port: 587,
  smtp_user: "",
  smtp_pass: "",
  smtp_from: "",
  whatsapp_template:
    "Olá {responsavel}, identificamos um processo trabalhista ({processo}) contra {empresa}. Podemos ajudar?",
  email_subject: "Processo trabalhista — {empresa}",
  email_template:
    "Prezado(a) {responsavel},\n\nProcesso {processo} na {vara} — {empresa} (valor: {valor}).\n\nAtenciosamente.",
  min_score_for_outreach: 40,
}

let activeConfig = null

function parseTrts(raw) {
  return String(raw || "1,2,3")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 24)
}

function normalizeSettings(data = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...data }
  return {
    enabled: Boolean(merged.enabled),
    collectEnabled: merged.collect_enabled !== false,
    outreachEnabled: merged.outreach_enabled !== false,
    datajudApiKey: String(merged.datajud_api_key || "").trim(),
    datajudTrts: parseTrts(merged.datajud_trts),
    collectDaysBack: Number(merged.datajud_days_back) || 7,
    collectPageSize: Number(merged.datajud_page_size) || 50,
    evolutionApiUrl: String(merged.evolution_api_url || "").replace(/\/$/, ""),
    evolutionApiKey: String(merged.evolution_api_key || "").trim(),
    evolutionInstance: String(merged.evolution_instance || "default"),
    smtp: {
      host: merged.smtp_host || "smtp.gmail.com",
      port: Number(merged.smtp_port) || 587,
      user: String(merged.smtp_user || "").trim(),
      pass: String(merged.smtp_pass || "").trim(),
      from: String(merged.smtp_from || merged.smtp_user || "").trim(),
    },
    whatsappTemplate: merged.whatsapp_template || DEFAULT_SETTINGS.whatsapp_template,
    emailSubject: merged.email_subject || DEFAULT_SETTINGS.email_subject,
    emailTemplate: merged.email_template || DEFAULT_SETTINGS.email_template,
    minScoreForOutreach: Number(merged.min_score_for_outreach) || 40,
  }
}

/** Carrega config do Firestore (online). Env vars são fallback opcional em CI. */
async function initConfig(db) {
  const snap = await db.collection("trabalhistaConfig").doc("settings").get()
  const fromFirestore = snap.exists ? snap.data() : {}

  const envOverlay = {}
  if (process.env.DATAJUD_API_KEY) envOverlay.datajud_api_key = process.env.DATAJUD_API_KEY
  if (process.env.DATAJUD_TRTS) envOverlay.datajud_trts = process.env.DATAJUD_TRTS
  if (process.env.EVOLUTION_API_URL) envOverlay.evolution_api_url = process.env.EVOLUTION_API_URL
  if (process.env.EVOLUTION_API_KEY) envOverlay.evolution_api_key = process.env.EVOLUTION_API_KEY
  if (process.env.EVOLUTION_INSTANCE) envOverlay.evolution_instance = process.env.EVOLUTION_INSTANCE
  if (process.env.SMTP_USER) envOverlay.smtp_user = process.env.SMTP_USER
  if (process.env.SMTP_PASS) envOverlay.smtp_pass = process.env.SMTP_PASS
  if (process.env.SMTP_FROM) envOverlay.smtp_from = process.env.SMTP_FROM
  if (process.env.MIN_SCORE_FOR_OUTREACH) {
    envOverlay.min_score_for_outreach = parseInt(process.env.MIN_SCORE_FOR_OUTREACH, 10)
  }

  activeConfig = normalizeSettings({ ...fromFirestore, ...envOverlay })
  return activeConfig
}

function getConfig() {
  if (!activeConfig) {
    activeConfig = normalizeSettings({})
  }
  return activeConfig
}

module.exports = {
  DEFAULT_SETTINGS,
  normalizeSettings,
  initConfig,
  getConfig,
}
