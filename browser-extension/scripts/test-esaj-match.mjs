import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { parseHTML } from "linkedom"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, "..")

function loadScript(relativePath, context) {
  new Function("globalThis", fs.readFileSync(path.join(root, relativePath), "utf8"))(context)
}

const html = `
<table id="tablePartesPrincipais">
  <tr>
    <td><span class="tipoDeParticipacao">Exeqte</span></td>
    <td class="nomeParteEAdvogado">Banco Bradesco S.A.<br><span class="mensagemExibindo">Advogado:</span> Dr. Teste</td>
  </tr>
  <tr>
    <td><span class="tipoDeParticipacao">Exectdo</span></td>
    <td class="nomeParteEAdvogado">Maria Silva Santos</td>
  </tr>
</table>
<div id="classeProcesso">Execução de Título Extrajudicial</div>
<div id="assuntoProcesso">Contratos Bancários</div>
`

const { document } = parseHTML(html)
const g = { globalThis: {} }
g.globalThis = g
loadScript("lib/banks.js", g)
g.CaptacaoBanks = g.globalThis.CaptacaoBanks
loadScript("lib/esaj-parse.js", g)

const result = g.EsajParse.analyzeProcessDocument(document)
console.log("match esperado: true ->", result.match)
console.log(JSON.stringify(result, null, 2))
process.exit(result.match ? 0 : 1)
