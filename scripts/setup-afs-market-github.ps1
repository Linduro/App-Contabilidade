# Configura GitHub Actions para AFS Market Intelligence (Cloud Run + Pages)
# Requer: gh auth login (uma vez)
# Uso: .\scripts\setup-afs-market-github.ps1

$ErrorActionPreference = "Stop"
$Repo = "Linduro/App-Contabilidade"

Write-Host ""
Write-Host "=== AFS Market Intelligence - setup GitHub ===" -ForegroundColor Cyan

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "Instale GitHub CLI: https://cli.github.com/"
}

gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Faca login no GitHub (abre o navegador):" -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
}

Write-Host ""
Write-Host "1/2 Ativando ENABLE_GCP_CLOUD_RUN=true ..."
gh variable set ENABLE_GCP_CLOUD_RUN --repo $Repo --body "true"

Write-Host ""
Write-Host "2/2 Disparando deploy Cloud Run + Pages ..."
gh workflow run "Deploy AFS Market Intelligence (Cloud Run)" --repo $Repo --ref main
Start-Sleep -Seconds 3
gh workflow run "Deploy to GitHub Pages" --repo $Repo --ref main

Write-Host ""
Write-Host "Pronto. Acompanhe em:"
Write-Host "  https://github.com/$Repo/actions"
Write-Host ""
Write-Host "Quando o Cloud Run terminar (5-10 min na 1a vez), apiBase vai para config.json."
Write-Host "Secret necessario: FIREBASE_SERVICE_ACCOUNT (JSON GCP contabilidade-ebed6)"
Write-Host ""
