require("dotenv").config()

let activeConfig = null

function parseTrts(raw) {
  return String(raw || "15")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n))
}

function initConfig() {
  activeConfig = {
    enabled: process.env.WORKER_ENABLED !== "false",
    collect_enabled: process.env.COLLECT_ENABLED !== "false",
    datajudApiKey: String(process.env.DATAJUD_API_KEY || "").trim(),
    datajudTrts: parseTrts(process.env.DATAJUD_TRTS || "1,2,3,15"),
    collectDaysBack: Number(process.env.DATAJUD_DAYS_BACK) || 7,
    collectPageSize: Number(process.env.DATAJUD_PAGE_SIZE) || 50,
    execucoesDaysBack: Number(process.env.EXECUCOES_DAYS_BACK) || 14,
    execucoesEnabled: process.env.EXECUCOES_ENABLED !== "false",
  }
  return activeConfig
}

function getConfig() {
  if (!activeConfig) throw new Error("Config não carregada — chame initConfig()")
  return activeConfig
}

module.exports = { initConfig, getConfig }
