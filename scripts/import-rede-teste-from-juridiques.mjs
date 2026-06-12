/**
 * Copia o módulo de rede social Juridiquês (somente leitura na origem) para rede-teste-web.
 * Não altera adv-forte-sistema-juridico.
 */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.join(__dirname, "..")
const sourceRoot = path.join(
  process.env.ADVFORTE_SOURCE ||
    path.join(process.env.USERPROFILE || "", "Downloads", "adv-forte-sistema-juridico"),
)
const destRoot = path.join(repoRoot, "rede-teste-web")

const COPY_DIRS = [
  ["app/(juridiques)", "app/(rede-teste)"],
  ["app/api/juridiques", "app/api/rede-teste"],
  ["lib/juridiques", "lib/rede-teste"],
  ["components/juridiques", "components/rede-teste"],
  ["components/ui", "components/ui"],
  ["server/trpc", "server/trpc"],
  ["lib/i18n", "lib/i18n"],
]

const COPY_FILES = [
  "lib/utils.ts",
  "lib/trpc-client.ts",
  "lib/trpc-server.ts",
  "lib/trpc-error-message.ts",
  "lib/prisma.ts",
  "lib/auth-client.ts",
  "lib/uploads.ts",
  "lib/media-url.ts",
  "lib/logger.ts",
  "lib/observability.ts",
  "lib/rate-limit.ts",
  "lib/storage.ts",
  "prisma/schema.prisma",
]

const SENSITIVE_PATTERNS = [
  /cartoonhq@gmail\.com/gi,
  /gabrieldouran@gmail\.com/gi,
  /marialima/gi,
  /maria\s*lima/gi,
  /@login\.advforte\.com/gi,
  /advforte\.com/gi,
  /www\.advforte\.com/gi,
]

const TEXT_REPLACEMENTS = [
  [/@\/components\/juridiques/g, "@/components/rede-teste"],
  [/@\/lib\/juridiques/g, "@/lib/rede-teste"],
  [/trpc\.juridiques/g, "trpc.redeTeste"],
  [/juridiquesRouter/g, "redeTesteRouter"],
  [/\/juridiques\b/g, "/rede-teste"],
  [/Juridiquês/g, "Rede Teste"],
  [/Juridiques/g, "RedeTeste"],
  [/juridiques-theme/g, "rede-teste-theme"],
  [/jq-portal-theme/g, "rt-portal-theme"],
  [/AdvForte/g, "Portal"],
  [/advforte/g, "portal"],
  [/ProductModeSwitch/g, "RedeTesteModeSwitch"],
  [/post-login-shell/g, "rede-teste-shell"],
  [/shareIntimation/g, "shareDraft"],
  [/intimation-share/g, "draft-share-disabled"],
  [/estagiario-sources/g, "assistant-sources-disabled"],
  [/notebooklm/gi, "assistant"],
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function shouldSkip(name) {
  return (
    name === "node_modules" ||
    name === ".next" ||
    name === ".git" ||
    name.endsWith(".map")
  )
}

function copyTree(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("SKIP missing:", src)
    return 0
  }
  ensureDir(dest)
  let count = 0
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (shouldSkip(entry.name)) continue
    const s = path.join(src, entry.name)
    let dName = entry.name
    if (dName === "juridiques") dName = "rede-teste"
    const d = path.join(dest, dName)
    if (entry.isDirectory()) count += copyTree(s, d)
    else if (/\.(ts|tsx|js|jsx|css|json|sql|md|mjs)$/.test(entry.name)) {
      let text = fs.readFileSync(s, "utf8")
      for (const [pat, rep] of TEXT_REPLACEMENTS) text = text.replace(pat, rep)
      for (const pat of SENSITIVE_PATTERNS) text = text.replace(pat, "[removido]")
      ensureDir(path.dirname(d))
      fs.writeFileSync(d, text, "utf8")
      count++
    }
  }
  return count
}

function copyFile(rel) {
  const src = path.join(sourceRoot, rel)
  const dest = path.join(destRoot, rel.replace(/juridiques/g, "rede-teste"))
  if (!fs.existsSync(src)) {
    console.warn("SKIP file:", rel)
    return 0
  }
  ensureDir(path.dirname(dest))
  let text = fs.readFileSync(src, "utf8")
  for (const [pat, rep] of TEXT_REPLACEMENTS) text = text.replace(pat, rep)
  for (const pat of SENSITIVE_PATTERNS) text = text.replace(pat, "[removido]")
  fs.writeFileSync(dest, text, "utf8")
  return 1
}

function extractJqCss() {
  const globals = path.join(sourceRoot, "app", "globals.css")
  if (!fs.existsSync(globals)) return
  const text = fs.readFileSync(globals, "utf8")
  const start = text.indexOf(".jq-portal-theme")
  const end = text.indexOf("/* End Juridiquês theme */")
  const slice =
    start >= 0
      ? text.slice(start, end > start ? end : undefined)
      : text.match(/\.jq-[^{]+{[^}]+}/g)?.join("\n") || ""
  const out = `/* Rede Teste theme (copiado do módulo social, sem AdvForte) */\n${slice.replace(/jq-/g, "rt-").replace(/juridiques/g, "rede-teste")}\n`
  fs.writeFileSync(path.join(destRoot, "app", "rede-teste-theme.css"), out, "utf8")
}

if (!fs.existsSync(sourceRoot)) {
  console.error("Origem não encontrada:", sourceRoot)
  process.exit(1)
}

console.log("Origem (read-only):", sourceRoot)
console.log("Destino:", destRoot)

let total = 0
for (const [srcRel, destRel] of COPY_DIRS) {
  const n = copyTree(path.join(sourceRoot, srcRel), path.join(destRoot, destRel))
  console.log(`Copied ${n} files: ${srcRel} -> ${destRel}`)
  total += n
}
for (const rel of COPY_FILES) total += copyFile(rel)

// Router rename
const routerSrc = path.join(destRoot, "server", "trpc", "routers", "juridiques.ts")
const routerDest = path.join(destRoot, "server", "trpc", "routers", "rede-teste.ts")
if (fs.existsSync(routerSrc)) {
  fs.renameSync(routerSrc, routerDest)
}

extractJqCss()
console.log(`\nTotal arquivos processados: ~${total}`)
console.log("Import concluído. Revise rede-teste-web/ antes do commit.")
