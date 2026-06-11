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

function buildIndexHtml() {
  const baseHtml = fs.readFileSync(path.join(afsRoot, "templates", "base.html"), "utf8")
  const indexRaw = fs.readFileSync(path.join(afsRoot, "templates", "index.html"), "utf8")

  const indexBody = indexRaw
    .replace(/\{% extends "base.html" %\}\s*/, "")
    .replace(/\{% block content %\}/, "")
    .replace(/\{% endblock %\}\s*$/, "")

  const configScript = `
    <script>
      (function () {
        var params = new URLSearchParams(window.location.search);
        var fromQuery = params.get("apiBase");
        if (fromQuery) {
          window.__AFS_API_BASE__ = fromQuery.replace(/\\/$/, "");
          return;
        }
        var match = window.location.pathname.match(/^(.*)\\/afs-valuation(?:\\/|$)/);
        window.__AFS_API_BASE__ = match ? match[1] + "/afs-api" : "";
      })();
    </script>`

  return baseHtml
    .replace(
      'href="{{ url_for(\'static\', filename=\'css/style.css\') }}?v=3"',
      'href="./css/style.css?v=4"',
    )
    .replace(
      '<script src="{{ url_for(\'static\', filename=\'js/app.js\') }}?v=3"></script>',
      `${configScript}\n    <script src="./js/app.js?v=4"></script>`,
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
  path.join(afsRoot, "static", "js", "app.js"),
  path.join(outDir, "js", "app.js"),
)
fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(), "utf8")

console.log("AFS static assets copied to public/afs-valuation/")
