/**
 * Atualiza config.json do AFS Market com apiBase do Cloud Run (preserva firebase/prospectDefaults).
 * Usado pelo workflow deploy-afs-market-cloudrun.yml
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(
  __dirname,
  "..",
  "site-de-notas-futurista",
  "public",
  "afs-market-intelligence",
  "config.json",
)

const apiBase = (process.env.SERVICE_URL || "").replace(/\/$/, "")
if (!apiBase) {
  console.error("SERVICE_URL não definida")
  process.exit(1)
}

const firebaseDefaults = {
  apiKey: "AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk",
  authDomain: "contabilidade-ebed6.firebaseapp.com",
  projectId: "contabilidade-ebed6",
  storageBucket: "contabilidade-ebed6.firebasestorage.app",
  messagingSenderId: "92104290412",
  appId: "1:92104290412:web:e99492aeb27bd9f1902849",
}

let config = {
  apiBase,
  firebase: firebaseDefaults,
  prospectDefaults: { capital_min: 2000000, capital_max: 10000000 },
}

if (fs.existsSync(configPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(configPath, "utf8"))
    config = {
      ...existing,
      apiBase,
      firebase: existing.firebase || firebaseDefaults,
      prospectDefaults: existing.prospectDefaults || config.prospectDefaults,
    }
  } catch {
    /* keep defaults */
  }
}

fs.mkdirSync(path.dirname(configPath), { recursive: true })
fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8")
console.log("config.json atualizado:", apiBase)
