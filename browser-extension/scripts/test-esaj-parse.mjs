/** Teste local: node scripts/test-esaj-parse.mjs [caminho-html] */
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { parseHTML } from "linkedom"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function loadScript(relativePath, context) {
  const code = fs.readFileSync(path.join(root, relativePath), "utf8")
  const fn = new Function("globalThis", code + "\nreturn globalThis;")
  return fn(context)
}

const htmlPath = process.argv[2] || path.join(process.env.TEMP || "/tmp", "esaj-sample.html")
const html = fs.readFileSync(htmlPath, "utf8")
const { document } = parseHTML(html)

const g = { globalThis: {} }
g.globalThis = g
loadScript("lib/banks.js", g)
g.CaptacaoBanks = g.globalThis.CaptacaoBanks
loadScript("lib/esaj-parse.js", g)

const result = g.EsajParse.analyzeProcessDocument(document, "https://example.test")
console.log(JSON.stringify(result, null, 2))
