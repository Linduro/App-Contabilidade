# Configura GitHub Actions para AFS Market Intelligence (Opção B — Cloud Run + Pages)
# Requer: gh auth login (uma vez)
# Uso: .\scripts\setup-afs-market-github.ps1

$ErrorActionPreference = "Stop"
$Repo = "Linduro/App-Contabilidade"

Write-Host "`n=== AFS Market Intelligence — setup GitHub ===" -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Instale GitHub CLI: https://cli.github.com/"
}

$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Faça login no GitHub (abre o navegador):" -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
}

Write-Host "`n1/2 Ativando ENABLE_GCP_CLOUD_RUN=true ..."
gh variable set ENABLE_GCP_CLOUD_RUN --repo $Repo --body "true"

Write-Host "`n2/2 Disparando deploy Cloud Run + Pages ..."
gh workflow run "Deploy AFS Market Intelligence (Cloud Run)" --repo $Repo --ref main
Start-Sleep -Seconds 3
gh workflow run "Deploy to GitHub Pages" --repo $Repo --ref main

Write-Host @"

Pronto. Acompanhe em:
  https://github.com/$Repo/actions

Quando o Cloud Run terminar (~5–10 min na 1ª vez), o workflow grava apiBase em config.json
e o Pages redeploy publica o backend online.

Se AFS_MARKET_API_URL ainda estiver vazia, o workflow Cloud Run preenche automaticamente
via commit — não é obrigatório setar manualmente.

Secret necessário (já deve existir): FIREBASE_SERVICE_ACCOUNT
  Settings → Secrets → Actions → FIREBASE_SERVICE_ACCOUNT
  (JSON da service account GCP do projeto contabilidade-ebed6)

"@ -ForegroundColor Green
