require("dotenv").config()

const { DATAJUD_PUBLIC_API_KEY } = require("../config/datajud")

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
    datajudApiKey: String(
      process.env.DATAJUD_API_KEY || DATAJUD_PUBLIC_API_KEY,
    ).trim(),
    datajudTrts: parseTrts(process.env.DATAJUD_TRTS || "1,2,3,15"),
    collectDaysBack: Number(process.env.DATAJUD_DAYS_BACK) || 60,
    collectPageSize: Number(process.env.DATAJUD_PAGE_SIZE) || 100,
    datajudMaxPages: Number(process.env.DATAJUD_MAX_PAGES) || 20,
    execucoesDaysBack: Number(process.env.EXECUCOES_DAYS_BACK) || 60,
    execucoesEnabled: process.env.EXECUCOES_ENABLED !== "false",
    altoValorEnabled: process.env.ALTO_VALOR_ENABLED !== "false",
    altoValorDaysBack: Number(process.env.ALTO_VALOR_DAYS_BACK) || 60,
  }
  return activeConfig
}

function getConfig() {
  if (!activeConfig) throw new Error("Config não carregada — chame initConfig()")
  return activeConfig
}

module.exports = { initConfig, getConfig }
