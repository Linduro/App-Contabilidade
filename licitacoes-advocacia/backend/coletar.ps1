# Coleta licitações do Licitita → classifica → salva no Firestore
# Uso: .\coletar.ps1
# Requer backend\.env com GOOGLE_APPLICATION_CREDENTIALS

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

$envFile = Join-Path $ScriptDir ".env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $name = $matches[1].Trim()
      $value = $matches[2].Trim().Trim('"')
      Set-Item -Path "env:$name" -Value $value
    }
  }
}

if (-not $env:GOOGLE_APPLICATION_CREDENTIALS) {
  Write-Host ""
  Write-Host "Falta GOOGLE_APPLICATION_CREDENTIALS." -ForegroundColor Red
  Write-Host "1. Firebase Console -> Service accounts -> Generate new private key"
  Write-Host "2. Copie backend\.env.example para backend\.env"
  Write-Host "3. Aponte GOOGLE_APPLICATION_CREDENTIALS para o arquivo JSON"
  Write-Host ""
  exit 1
}

if (-not (Test-Path $env:GOOGLE_APPLICATION_CREDENTIALS)) {
  Write-Host "Arquivo nao encontrado: $($env:GOOGLE_APPLICATION_CREDENTIALS)" -ForegroundColor Red
  exit 1
}

Write-Host "Iniciando coleta de licitacoes..." -ForegroundColor Cyan
npm run job:collect
$code = $LASTEXITCODE

if ($code -eq 0) {
  Write-Host ""
  Write-Host "Concluido! Atualize o dashboard no navegador." -ForegroundColor Green
} else {
  Write-Host ""
  Write-Host "Coleta terminou com erros (codigo $code). Veja a saida acima." -ForegroundColor Yellow
}

exit $code
