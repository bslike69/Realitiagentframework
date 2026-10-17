$ErrorActionPreference = 'Stop'
try {
  $health = Invoke-RestMethod 'http://127.0.0.1:8787/health' -TimeoutSec 2
  if ($health.version -and $health.client) { Write-Host 'REALITI City is already running.'; exit 0 }
  throw 'Port 8787 is occupied by an unexpected or unhealthy service.'
} catch { if ($_.Exception.Message -like 'Port 8787*') { throw } }
$env:HOST = '127.0.0.1'
$env:PORT = '8787'
$env:REALITI_DATA = 'C:/Users/bslik/Documents/RealitiCity-data'
New-Item -ItemType Directory -Force -Path $env:REALITI_DATA | Out-Null
Start-Process -FilePath 'C:\Program Files\nodejs\node.exe' -ArgumentList ('"' + $PSScriptRoot + '\city-managed.cjs"') -WindowStyle Hidden -RedirectStandardOutput (Join-Path $env:REALITI_DATA 'server.log') -RedirectStandardError (Join-Path $env:REALITI_DATA 'server-error.log')
for ($attempt=0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Milliseconds 200
  try { $health = Invoke-RestMethod 'http://127.0.0.1:8787/health' -TimeoutSec 1; if ($health.ok -and $health.client) { Write-Host 'REALITI City is running in the background.'; exit 0 } } catch {}
}
throw 'City did not become healthy. See RealitiCity-data\server-error.log.'
