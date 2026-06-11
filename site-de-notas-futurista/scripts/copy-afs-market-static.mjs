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
  const raw = fs.readFileSync(path.join(marketRoot, "templates", "index.html"), "utf8")

  const configScript = `
    <script>
      (function () {
        var params = new URLSearchParams(window.location.search);
        var fromQuery = params.get("apiBase");
        if (fromQuery) {
          window.__AFS_MARKET_API_BASE__ = fromQuery.replace(/\\/$/, "");
          return;
        }
        fetch("./config.json?t=" + Date.now())
          .then(function (r) { return r.json(); })
          .then(function (cfg) {
            if (cfg && cfg.apiBase) window.__AFS_MARKET_API_BASE__ = cfg.apiBase.replace(/\\/$/, "");
          })
          .catch(function () {});
      })();
    </script>
    <script src="./js/browser-api.js?v=1"></script>`

  return raw
    .replace(
      'href="{{ url_for(\'static\', filename=\'css/style.css\') }}?v=1"',
      'href="./css/style.css?v=1"',
    )
    .replace(
      /<script src="{{ url_for\('static', filename='js\/browser-api.js'\) }}\?v=1"><\/script>\s*<script src="{{ url_for\('static', filename='js\/app.js'\) }}\?v=1"><\/script>/,
      `${configScript}\n    <script src="./js/app.js?v=1"></script>`,
    )
}

ensureDir(path.join(outDir, "css"))
ensureDir(path.join(outDir, "js"))

fs.copyFileSync(
  path.join(marketRoot, "static", "css", "style.css"),
  path.join(outDir, "css", "style.css"),
)
fs.copyFileSync(
  path.join(marketRoot, "static", "js", "browser-api.js"),
  path.join(outDir, "js", "browser-api.js"),
)
fs.copyFileSync(
  path.join(marketRoot, "static", "js", "app.js"),
  path.join(outDir, "js", "app.js"),
)
fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(), "utf8")

const apiBase =
  process.env.AFS_MARKET_API_URL || process.env.NEXT_PUBLIC_AFS_MARKET_API_URL || ""
let configToWrite = { apiBase: apiBase.replace(/\/$/, "") }

const configOutPath = path.join(outDir, "config.json")
if (!configToWrite.apiBase && fs.existsSync(configOutPath)) {
  try {
    const existing = JSON.parse(fs.readFileSync(configOutPath, "utf8"))
    if (existing.apiBase) configToWrite = existing
  } catch {
    /* keep env value */
  }
}

fs.writeFileSync(configOutPath, JSON.stringify(configToWrite, null, 2), "utf8")

console.log("AFS Market Intelligence static assets copied to public/afs-market-intelligence/")
