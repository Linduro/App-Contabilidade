import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.join(__dirname, "..")
const marketRoot = path.join(portalRoot, "..", "afs-market-intelligence")
const outDir = path.join(portalRoot, "public", "afs-market-intelligence")

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function buildIndexHtml() {
  let raw = fs.readFileSync(path.join(marketRoot, "templates", "index.html"), "utf8")

  raw = raw.replace(
    /\{\{\s*url_for\('static',\s*filename='css\/style\.css'\)\s*\}\}/g,
    "./css/style.css",
  )
  raw = raw.replace(
    /\{\{\s*url_for\('static',\s*filename='js\/([^']+)'\)\s*\}\}/g,
    "./js/$1",
  )

  const basePath = (process.env.GITHUB_SITE_BASE || "").replace(/\/$/, "")
  const baseScript = `<script>window.__AFS_BASE_PATH__=${JSON.stringify(basePath)};</script>`
  raw = raw.replace("</head>", `    ${baseScript}\n</head>`)

  return raw
}

ensureDir(path.join(outDir, "css"))
ensureDir(path.join(outDir, "js"))

const jsDir = path.join(marketRoot, "static", "js")
for (const file of fs.readdirSync(jsDir)) {
  if (file.endsWith(".js")) {
    fs.copyFileSync(path.join(jsDir, file), path.join(outDir, "js", file))
  }
}

fs.copyFileSync(
  path.join(marketRoot, "static", "css", "style.css"),
  path.join(outDir, "css", "style.css"),
)
fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(), "utf8")

const firebaseDefaults = {
  apiKey: "AIzaSyAQS75d3hx5mDQwixNRjyRPLOSVWpyDpvk",
  authDomain: "contabilidade-ebed6.firebaseapp.com",
  projectId: "contabilidade-ebed6",
  storageBucket: "contabilidade-ebed6.firebasestorage.app",
  messagingSenderId: "92104290412",
  appId: "1:92104290412:web:e99492aeb27bd9f1902849",
}

const apiBase =
  process.env.AFS_MARKET_API_URL || process.env.NEXT_PUBLIC_AFS_MARKET_API_URL || ""

let configToWrite = {
  apiBase: apiBase.replace(/\/$/, ""),
  firebase: firebaseDefaults,
}

const configOutPath = path.join(outDir, "config.json")
if (fs.existsSync(configOutPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(configOutPath, "utf8"))
    configToWrite = {
      ...configToWrite,
      ...existing,
      firebase: existing.firebase || firebaseDefaults,
    }
  } catch {
    /* keep defaults */
  }
}

fs.writeFileSync(configOutPath, JSON.stringify(configToWrite, null, 2), "utf8")

const examplePath = path.join(marketRoot, "static", "config.json.example")
if (fs.existsSync(examplePath)) {
  fs.copyFileSync(examplePath, path.join(outDir, "config.json.example"))
}

console.log("AFS Market Intelligence static assets copied to public/afs-market-intelligence/")
