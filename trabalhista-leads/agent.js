#!/usr/bin/env node
/**
 * Worker cloud — lê config do Firestore, executa coleta/outreach.
 * Roda via GitHub Actions (cron); não requer PC local.
 */
const { initConfig } = require("./lib/config-loader")
const { initFirestore } = require("./lib/firestore")
const { runCollect } = require("./lib/collector")
const { runOutreach } = require("./lib/queue-processor")

const args = process.argv.slice(2)
const onceFlag = args.find((a) => a.startsWith("--once="))
const onceMode = onceFlag ? onceFlag.split("=")[1] : "both"

async function main() {
  const db = initFirestore()
  const config = await initConfig(db)

  console.log("[worker] trabalhista-leads — config carregada do Firestore")

  if (!config.enabled) {
    console.log("[worker] módulo desabilitado em trabalhistaConfig/settings (enabled=false)")
    process.exit(0)
  }

  if (onceMode === "collect" || onceMode === "both") {
    if (!config.collectEnabled) {
      console.log("[worker] coleta desabilitada")
    } else if (!config.datajudApiKey) {
      console.error("[worker] datajud_api_key ausente — configure no dashboard")
      process.exit(1)
    } else {
      await runCollect()
    }
  }

  if (onceMode === "outreach" || onceMode === "both") {
    if (!config.outreachEnabled) {
      console.log("[worker] outreach desabilitado")
    } else {
      await runOutreach()
    }
  }

  console.log("[worker] concluído")
}

main().catch((err) => {
  console.error("[worker] fatal:", err)
  process.exit(1)
})
