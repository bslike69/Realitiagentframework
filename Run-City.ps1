# REALITI City: start, wait, stop. One window does the whole run. (Claude, 2026-10-14)
# Press Enter to stop the city cleanly. Closing the window with X leaves it running; Stop-City.cmd stops it later.
# (A finally block also tries to stop it on Ctrl+C; that path is untested on Windows.)
# Same settings as Start-City.ps1. Environment overrides exist only for testing.
$ErrorActionPreference = 'Stop'
$port = if ($env:REALITI_CITY_PORT) { $env:REALITI_CITY_PORT } else { '8787' }
$data = if ($env:REALITI_CITY_DATA) { $env:REALITI_CITY_DATA } else { 'C:/Users/bslik/Documents/RealitiCity-data' }
$node = if ($env:REALITI_NODE) { $env:REALITI_NODE } else { 'C:\Program Files\nodejs\node.exe' }
$base = "http://127.0.0.1:$port"
$pidFile = Join-Path $data 'city.pid'
$stopFile = Join-Path $data 'city.stop'
$errLog = Join-Path $data 'server-error.log'

function Test-City {
  try { $h = Invoke-RestMethod "$base/health" -TimeoutSec 2; return [bool]($h.ok -and $h.client) } catch { return $false }
}

function Stop-TheCity {
  [IO.File]::WriteAllText($stopFile, 'stop')
  Write-Host 'Stopping the city...'
  for ($i = 0; $i -lt 75; $i++) {
    Start-Sleep -Milliseconds 200
    if (-not (Test-Path $pidFile) -and -not (Test-City)) {
      Write-Host 'City stopped cleanly. Shared records are saved.' -ForegroundColor Green
      return
    }
  }
  Write-Host "The city did not confirm shutdown within 15 seconds. Check $errLog" -ForegroundColor Yellow
}

Write-Host 'REALITI City' -ForegroundColor Cyan
if (Test-City) {
  if (-not (Test-Path $pidFile)) {
    Write-Host "A city is already running at $base, started from a terminal. Stop it there with Ctrl+C."
    exit 0
  }
  Write-Host 'The city was already running in the background. This window will stop it when you are done.'
} else {
  $env:HOST = '127.0.0.1'
  $env:PORT = $port
  $env:REALITI_DATA = $data
  New-Item -ItemType Directory -Force -Path $data | Out-Null
  $opts = @{
    FilePath = $node
    ArgumentList = ('"' + (Join-Path $PSScriptRoot 'city-managed.cjs') + '"')
    RedirectStandardOutput = (Join-Path $data 'server.log')
    RedirectStandardError = $errLog
  }
  if ($PSVersionTable.PSEdition -eq 'Desktop' -or $IsWindows) { $opts.WindowStyle = 'Hidden' }
  Start-Process @opts | Out-Null
  $up = $false
  for ($i = 0; $i -lt 50; $i++) { Start-Sleep -Milliseconds 200; if (Test-City) { $up = $true; break } }
  if (-not $up) {
    Write-Host 'The city did not start. Last lines of the error log:' -ForegroundColor Red
    if (Test-Path $errLog) { Get-Content $errLog -Tail 10 }
    exit 1
  }
}

$stopped = $false
try {
  $h = Invoke-RestMethod "$base/health" -TimeoutSec 2
  Write-Host ''
  Write-Host "Running at $base (this computer only). Ledger records: $($h.records)." -ForegroundColor Green
  Write-Host "Data folder: $data"
  Write-Host ''
  Write-Host 'Press Enter to stop the city.'
  Write-Host '(Closing this window with X leaves the city running; Stop-City.cmd stops it later.)'
  [void](Read-Host)
  Stop-TheCity
  $stopped = $true
} finally {
  if (-not $stopped) { Stop-TheCity }
}
