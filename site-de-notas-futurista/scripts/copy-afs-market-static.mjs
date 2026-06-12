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

function copyDir(src, dest) {
  ensureDir(dest)
  for (const name of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, name.name)
    const d = path.join(dest, name.name)
    if (name.isDirectory()) copyDir(s, d)
    else fs.copyFileSync(s, d)
  }
}

function copyJsTree(srcJs, destJs) {
  ensureDir(destJs)
  for (const name of fs.readdirSync(srcJs, { withFileTypes: true })) {
    const s = path.join(srcJs, name.name)
    const d = path.join(destJs, name.name)
    if (name.isDirectory()) copyJsTree(s, d)
    else if (name.name.endsWith(".js")) fs.copyFileSync(s, d)
  }
}

function buildIndexHtml() {
  let raw = fs.readFileSync(path.join(marketRoot, "templates", "index.html"), "utf8")

  raw = raw.replace(
    /\{\{\s*url_for\('static',\s*filename='css\/([^']+)'\)\s*\}\}/g,
    "./css/$1",
  )
  raw = raw.replace(
    /\{\{\s*url_for\('static',\s*filename='js\/([^']+)'\)\s*\}\}/g,
    "./js/$1",
  )

  const basePath = (process.env.GITHUB_SITE_BASE || "").replace(/\/$/, "")
  const buildId = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "")
  const baseScript =
    `<script>window.__AFS_BASE_PATH__=${JSON.stringify(basePath)};window.__AFS_BUILD__="${buildId}";</script>`
  raw = raw.replace("</head>", `    ${baseScript}\n</head>`)

  return raw
}

ensureDir(path.join(outDir, "css"))
ensureDir(path.join(outDir, "js"))

copyJsTree(path.join(marketRoot, "static", "js"), path.join(outDir, "js"))

if (fs.existsSync(path.join(marketRoot, "static", "legacy"))) {
  copyDir(path.join(marketRoot, "static", "legacy"), path.join(outDir, "legacy"))
}

for (const css of fs.readdirSync(path.join(marketRoot, "static", "css"))) {
  fs.copyFileSync(
    path.join(marketRoot, "static", "css", css),
    path.join(outDir, "css", css),
  )
}

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

// Remove cópia legada em js/seed-data.js (agora vive em js/core/seed-data.js)
const legacySeed = path.join(outDir, "js", "seed-data.js")
if (fs.existsSync(legacySeed) && fs.existsSync(path.join(outDir, "js", "core", "seed-data.js"))) {
  fs.unlinkSync(legacySeed)
  console.warn("Removido js/seed-data.js legado (use js/core/seed-data.js)")
}

const coreSeed = path.join(outDir, "js", "core", "seed-data.js")
if (!fs.existsSync(coreSeed)) {
  throw new Error("Falha no build AFS: js/core/seed-data.js ausente")
}
const coreSeedText = fs.readFileSync(coreSeed, "utf8")
if (!coreSeedText.includes("from './store.js'")) {
  throw new Error("Falha no build AFS: import inválido em core/seed-data.js")
}

const bootPath = path.join(outDir, "js", "core", "boot.js")
const bootText = fs.readFileSync(bootPath, "utf8")
if (!bootText.includes("from './seed-data.js'")) {
  throw new Error("Falha no build AFS: boot.js deve importar ./seed-data.js")
}

console.log("AFS Market Intelligence static assets copied to public/afs-market-intelligence/")
