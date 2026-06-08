#!/usr/bin/env node
/**
 * Worker unificado na nuvem (GitHub Actions).
 * Config via variáveis de ambiente; filtros regionais via Firestore por módulo.
 */
const { initFirestore } = require("./lib/firestore")
const { initConfig } = require("./lib/config-loader")

const args = process.argv.slice(2)
const moduleArg = args.find((a) => a.startsWith("--module="))
const taskArg = args.find((a) => a.startsWith("--task="))
const moduleName = moduleArg ? moduleArg.split("=")[1] : "all"
const task = taskArg ? taskArg.split("=")[1] : "collect"

async function main() {
  initFirestore()
  const config = initConfig()

  if ((moduleName === "trabalhista" || moduleName === "all") && task === "collect") {
    if (config.enabled && config.collect_enabled !== false) {
      const { runCollectTrabalhista } = require("./modules/trabalhista/collect")
      await runCollectTrabalhista()
    } else {
      console.log("[worker] coleta trabalhista desabilitada (WORKER_ENABLED/COLLECT_ENABLED)")
    }
  }

  if ((moduleName === "execucoesRurais" || moduleName === "all") && task === "collect") {
    if (config.execucoesEnabled) {
      const { runCollectExecucoesRurais } = require("./modules/execucoes-rurais/collect")
      await runCollectExecucoesRurais()
    } else {
      console.log("[worker] coleta execuções rurais desabilitada (EXECUCOES_ENABLED=false)")
    }
  }

  console.log("[worker] concluído")
}

main().catch((err) => {
  console.error("[worker] fatal:", err)
  process.exit(1)
})
