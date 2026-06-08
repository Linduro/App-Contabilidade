const { spawnSync } = require("child_process")
const path = require("path")

const SCRIPT = path.join(__dirname, "../triage/run_triage.py")

function resolvePython() {
  if (process.env.PYTHON) return process.env.PYTHON
  const candidates = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"]
  for (const cmd of candidates) {
    const probe = spawnSync(cmd, ["--version"], { encoding: "utf8" })
    if (probe.status === 0) return cmd
  }
  return "python3"
}

/**
 * Executa triagem Python sobre registros normalizados do Datajud.
 * @param {"trabalhista"|"execucoesRurais"|"execucoesAltoValor"} modulo
 * @param {object[]} records
 */
function runTriage(modulo, records) {
  const python = resolvePython()
  const input = JSON.stringify({ records })

  const result = spawnSync(python, [SCRIPT, modulo], {
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  })

  if (result.error) {
    throw new Error(`Triagem Python indisponível (${python}): ${result.error.message}`)
  }

  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || "").trim()
    throw new Error(`Triagem falhou (exit ${result.status}): ${err.slice(0, 400)}`)
  }

  let payload
  try {
    payload = JSON.parse(result.stdout)
  } catch {
    throw new Error(`Triagem retornou JSON inválido: ${String(result.stdout).slice(0, 200)}`)
  }

  if (payload.error) {
    throw new Error(payload.error)
  }

  return {
    records: payload.records || [],
    stats: payload.stats || {},
  }
}

module.exports = { runTriage }
