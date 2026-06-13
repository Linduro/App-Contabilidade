import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const portalRoot = path.join(__dirname, "..")
const repoRoot = path.join(portalRoot, "..")

const BUILD = process.env.AFS_STATIC_BUILD || "32"

const VERSIONS = [
  {
    label: "V1.0",
    version: "1.0",
    sourceDir: path.join(repoRoot, "afs-valuation-v1.0"),
    publicSegment: "afs-valuation",
  },
  {
    label: "V1.1",
    version: "1.1",
    sourceDir: path.join(repoRoot, "afs-valuation-v1.1"),
    publicSegment: "afs-valuation-v1.1",
  },
]

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function buildIndexHtml(afsRoot, { build, version, versionLabel }) {
  const baseHtml = fs.readFileSync(path.join(afsRoot, "templates", "base.html"), "utf8")
  const indexRaw = fs.readFileSync(path.join(afsRoot, "templates", "index.html"), "utf8")

  const indexBody = indexRaw
    .replace(/\{% extends "base.html" %\}\s*/, "")
    .replace(/\{% block content %\}/, "")
    .replace(/\{% endblock %\}\s*$/, "")

  const configScript = `
    <script src="https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js"></script>
    <script>
      window.__AFS_BUILD__ = "${build}";
      window.__AFS_APP_VERSION__ = "${version}";
      (function () {
        var badge = document.getElementById("afsBuildBadge");
        if (badge) badge.textContent = "${versionLabel} · build ${build}";
        var path = window.location.pathname || "";
        var repoBase = path.replace(/\\/(afs-valuation-v1\\.1|afs-valuation)(\\/.*)?$/, "") || "";
        var v10 = repoBase + "/afs-valuation/index.html";
        var v11 = repoBase + "/afs-valuation-v1.1/index.html";
        var isV11 = /afs-valuation-v1\\.1/.test(path);
        var v10El = document.getElementById("afsVersionV10");
        var v11El = document.getElementById("afsVersionV11");
        if (v10El) {
          v10El.href = v10;
          v10El.classList.toggle("active", !isV11);
        }
        if (v11El) {
          v11El.href = v11;
          v11El.classList.toggle("active", isV11);
        }
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
    <script src="./js/photo-resolver.js?v=${build}"></script>
    <script src="./js/learning-rules.js?v=${build}"></script>
    <script src="./js/browser-evaluation.js?v=${build}"></script>
    <script src="./js/browser-api.js?v=${build}"></script>`

  return baseHtml
    .replace(
      '<meta name="viewport"',
      '<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">\n    <meta name="viewport"',
    )
    .replace(
      'href="{{ url_for(\'static\', filename=\'css/style.css\') }}?v=3"',
      `href="./css/style.css?v=${build}"`,
    )
    .replace(
      '<script src="{{ url_for(\'static\', filename=\'js/app.js\') }}?v=3"></script>',
      `${configScript}\n    <script src="./js/app.js?v=${build}"></script>`,
    )
    .replace("{% block content %}{% endblock %}", indexBody)
}

function copyStaticAssets(afsRoot, outDir, meta) {
  ensureDir(path.join(outDir, "css"))
  ensureDir(path.join(outDir, "js"))

  const staticFiles = [
    ["static/css/style.css", "css/style.css"],
    ["static/js/learning-rules.js", "js/learning-rules.js"],
    ["static/js/photo-resolver.js", "js/photo-resolver.js"],
    ["static/js/browser-api.js", "js/browser-api.js"],
    ["static/js/browser-evaluation.js", "js/browser-evaluation.js"],
    ["static/js/app.js", "js/app.js"],
  ]

  for (const [src, dest] of staticFiles) {
    fs.copyFileSync(path.join(afsRoot, src), path.join(outDir, dest))
  }

  fs.writeFileSync(path.join(outDir, "index.html"), buildIndexHtml(afsRoot, meta), "utf8")

  const versionFile = path.join(afsRoot, "VERSION")
  if (fs.existsSync(versionFile)) {
    fs.copyFileSync(versionFile, path.join(outDir, "VERSION.txt"))
  }
}

function writeConfig(outDir) {
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
}

for (const entry of VERSIONS) {
  if (!fs.existsSync(entry.sourceDir)) {
    console.error(`Missing source: ${entry.sourceDir}`)
    process.exit(1)
  }

  const outDir = path.join(portalRoot, "public", entry.publicSegment)
  const meta = { build: BUILD, version: entry.version, versionLabel: entry.label }

  copyStaticAssets(entry.sourceDir, outDir, meta)
  writeConfig(outDir)

  console.log(`AFS ${entry.label} copied to public/${entry.publicSegment}/`)
}
