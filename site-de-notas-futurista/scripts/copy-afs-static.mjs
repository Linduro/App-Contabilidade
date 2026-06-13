import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.join(__dirname, "..")
const afsRoot = path.join(portalRoot, "..", "afs-valuation")
const outDir = path.join(portalRoot, "public", "afs-valuation")

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

const BUILD = process.env.AFS_STATIC_BUILD || "26"

function buildIndexHtml() {
  const baseHtml = fs.readFileSync(path.join(afsRoot, "templates", "base.html"), "utf8")
  const indexRaw = fs.readFileSync(path.join(afsRoot, "templates", "index.html"), "utf8")

  const indexBody = indexRaw
    .replace(/\{% extends "base.html" %\}\s*/, "")
    .replace(/\{% block content %\}/, "")
    .replace(/\{% endblock %\}\s*$/, "")

  const configScript = `
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
    <script>
      window.__AFS_BUILD__ = "${BUILD}";
      (function () {
        var badge = document.getElementById("afsBuildBadge");
        if (badge) badge.textContent = "build ${BUILD}";
        var params = new URLSearchParams(window.location.search);
        var fromQuery = params.get("apiBase");
        if (fromQuery) {
          var b = fromQuery.replace(/\\/$/, "");
          if (!/\\/afs-api$/i.test(b) && !/github\\.io\\/.*afs-api/i.test(b)) {
            window.__AFS_API_BASE__ = b;
          }
        }
      })();
    </script>
    <script src="./js/photo-resolver.js?v=${BUILD}"></script>
    <script src="./js/learning-rules.js?v=${BUILD}"></script>
    <script src="./js/browser-evaluation.js?v=${BUILD}"></script>
    <script src="./js/browser-api.js?v=${BUILD}"></script>`

  return baseHtml
    .replace(
      '<meta name="viewport"',
      '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n    <meta name="viewport"',
    )
    .replace(
      'href="{{ url_for(\'static\', filename=\'css/style.css\') }}?v=3"',
      `href="./css/style.css?v=${BUILD}"`,
    )
    .replace(
      '<script src="{{ url_for(\'static\', filename=\'js/app.js\') }}?v=3"></script>',
      `${configScript}\n    <script src="./js/app.js?v=${BUILD}"></script>`,
    )
    .replace("{% block content %}{% endblock %}", indexBody)
}

ensureDir(path.join(outDir, "css"))
ensureDir(path.join(outDir, "js"))

fs.copyFileSync(
  path.join(afsRoot, "static", "css", "style.css"),
  path.join(outDir, "css", "style.css"),
)
fs.copyFileSync(
  path.join(afsRoot, "static", "js", "learning-rules.js"),
  path.join(outDir, "js", "learning-rules.js"),
)
fs.copyFileSync(
  path.join(afsRoot, "static", "js", "photo-resolver.js"),
  path.join(outDir, "js", "photo-resolver.js"),
)
fs.copyFileSync(
  path.join(afsRoot, "static", "js", "browser-api.js"),
  path.join(outDir, "js", "browser-api.js"),
)
fs.copyFileSync(
  path.join(afsRoot, "static", "js", "browser-evaluation.js"),
  path.join(outDir, "js", "browser-evaluation.js"),
)
fs.copyFileSync(
  path.join(afsRoot, "static", "js", "app.js"),
  path.join(outDir, "js", "app.js"),
)
fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(), "utf8")

const apiBase = process.env.AFS_API_URL || process.env.NEXT_PUBLIC_AFS_API_URL || ""
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

console.log("AFS static assets copied to public/afs-valuation/")
