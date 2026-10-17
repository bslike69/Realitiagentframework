# REALITI quiet branch: a separate, password-protected city reachable from the internet through a temporary
# Cloudflare quick tunnel (a random https://<words>.trycloudflare.com address, no Cloudflare account).
# (Claude, 2026-10-17)
#
# - It does not touch your usual city (port 8787, RealitiCity-data). This one has its own port and data folder.
# - The server only listens on this computer (127.0.0.1); the tunnel is the only way in, and every request needs the
#   password except /health.
# - The password is made once and kept in the data folder, so invites stay valid across restarts. The tunnel address
#   changes every time you start this.
# - Press Enter in this window to stop both. Closing the window with X can leave them running; Stop-Public-City.cmd
#   stops them later.
$ErrorActionPreference = 'Stop'
$port = if ($env:REALITI_PUBLIC_PORT) { $env:REALITI_PUBLIC_PORT } else { '8790' }
$data = if ($env:REALITI_PUBLIC_DATA) { $env:REALITI_PUBLIC_DATA } else { (Join-Path (Split-Path $PSScriptRoot -Parent) 'public-city-data') }
$node = if ($env:REALITI_NODE) { $env:REALITI_NODE } else { 'C:\Program Files\nodejs\node.exe' }
$base = "http://127.0.0.1:$port"
$pidFile = Join-Path $data 'city.pid'
$stopFile = Join-Path $data 'city.stop'
$tunnelPidFile = Join-Path $data 'tunnel.pid'
$errLog = Join-Path $data 'server-error.log'
$tunnelLog = Join-Path $data 'tunnel.log'
$invite = Join-Path $data 'INVITE.txt'

Write-Host 'REALITI public city (quiet branch)' -ForegroundColor Cyan

# --- cloudflared
$cf = $null
$c = Get-Command cloudflared -ErrorAction SilentlyContinue
if ($c) { $cf = $c.Source }
if (-not $cf) {
  foreach ($p in @("${env:ProgramFiles(x86)}\cloudflared\cloudflared.exe", "$env:ProgramFiles\cloudflared\cloudflared.exe",
                   "$env:LOCALAPPDATA\Microsoft\WinGet\Links\cloudflared.exe", "$env:USERPROFILE\cloudflared.exe",
                   "$env:USERPROFILE\Downloads\cloudflared.exe", "$env:USERPROFILE\Downloads\cloudflared-windows-amd64.exe")) {
    if ($p -and (Test-Path $p)) { $cf = $p; break }
  }
}
if (-not $cf) {
  Write-Host 'cloudflared was not found, so there is no tunnel to start.' -ForegroundColor Yellow
  Write-Host 'Install it with:  winget install --id Cloudflare.cloudflared   then run this again.'
  exit 1
}
Write-Host "cloudflared: $cf"

function Test-City {
  try { $h = Invoke-RestMethod "$base/health" -TimeoutSec 2; return [bool]$h.ok } catch { return $false }
}

# --- password, made once
New-Item -ItemType Directory -Force -Path $data | Out-Null
$pwFile = Join-Path $data 'password.txt'
if (-not (Test-Path $pwFile)) {
  $bytes = New-Object byte[] 18
  [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  $pw = [Convert]::ToBase64String($bytes).Replace('+', 'k').Replace('/', 'q').Replace('=', '')
  [IO.File]::WriteAllText($pwFile, $pw)
}
$pw = ([IO.File]::ReadAllText($pwFile)).Trim()

# --- source bundle: what is running, offered to every visitor (AGPL-3.0) and used by remote visitors to set up
$clientDir = Join-Path $data 'client'
New-Item -ItemType Directory -Force -Path $clientDir | Out-Null
$bundle = Join-Path $clientDir 'realiti-quiet-source.tgz'
$tarOk = $false
try { & tar.exe -czf $bundle --exclude=node_modules --exclude=.git --exclude='*.bak*' -C $PSScriptRoot .; $tarOk = ($LASTEXITCODE -eq 0) } catch { $tarOk = $false }
if ($tarOk) { Write-Host "Source bundle: $([math]::Round((Get-Item $bundle).Length / 1MB, 1)) MB" }
else { Write-Host 'Could not make the source bundle (tar.exe); visitors will need the code another way.' -ForegroundColor Yellow }

# --- server
if (Test-City) {
  Write-Host "Something is already answering on $base. Stop it first (Stop-Public-City.cmd), or set REALITI_PUBLIC_PORT." -ForegroundColor Yellow
  exit 1
}
$env:HOST = '127.0.0.1'
$env:PORT = $port
$env:REALITI_DATA = $data
$env:SERVER_PASSWORD = $pw
$env:TRUST_PROXY = '1'
$env:SHARD_SYNC = '0'
$env:SHARD_NAME = 'Meridian City (public)'
$env:MAX_PEERS = '32'
$env:MAX_EVENT_CLIENTS = '32'
Remove-Item Env:ADMIN_TOKEN -ErrorAction SilentlyContinue
$opts = @{
  FilePath = $node
  ArgumentList = ('"' + (Join-Path $PSScriptRoot 'city-managed.cjs') + '"')
  RedirectStandardOutput = (Join-Path $data 'server.log')
  RedirectStandardError = $errLog
  WindowStyle = 'Hidden'
}
Start-Process @opts | Out-Null
$up = $false
for ($i = 0; $i -lt 50; $i++) { Start-Sleep -Milliseconds 200; if (Test-City) { $up = $true; break } }
if (-not $up) {
  Write-Host 'The city did not start. Last lines of the error log:' -ForegroundColor Red
  if (Test-Path $errLog) { Get-Content $errLog -Tail 10 }
  exit 1
}
Write-Host "City running on $base (password protected)." -ForegroundColor Green

function Stop-All {
  if (Test-Path $tunnelPidFile) {
    $tp = [int]([IO.File]::ReadAllText($tunnelPidFile))
    Stop-Process -Id $tp -ErrorAction SilentlyContinue
    Remove-Item $tunnelPidFile -ErrorAction SilentlyContinue
    Write-Host 'Tunnel closed.'
  }
  [IO.File]::WriteAllText($stopFile, 'stop')
  for ($i = 0; $i -lt 75; $i++) {
    Start-Sleep -Milliseconds 200
    if (-not (Test-Path $pidFile) -and -not (Test-City)) { Write-Host 'City stopped cleanly.' -ForegroundColor Green; return }
  }
  Write-Host "The city did not confirm shutdown within 15 seconds. Check $errLog" -ForegroundColor Yellow
}

# --- tunnel
function Start-Tunnel([string[]]$cfArgs) {
  Remove-Item $tunnelLog, "$tunnelLog.out" -ErrorAction SilentlyContinue
  $t = Start-Process -FilePath $cf -ArgumentList $cfArgs -RedirectStandardError $tunnelLog -RedirectStandardOutput "$tunnelLog.out" -WindowStyle Hidden -PassThru
  [IO.File]::WriteAllText($tunnelPidFile, [string]$t.Id)
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    $txt = ''
    foreach ($f in @($tunnelLog, "$tunnelLog.out")) { if (Test-Path $f) { $txt += (Get-Content $f -Raw -ErrorAction SilentlyContinue) } }
    $m = [regex]::Match($txt, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { return $m.Value }
    if ($t.HasExited) { return $null }
  }
  return $null
}
# An existing ~/.cloudflared/config.yml can get in the way of a quick tunnel, so point it at an empty config first.
$emptyCfg = Join-Path $data 'cloudflared-empty.yml'
[IO.File]::WriteAllText($emptyCfg, '')
$url = Start-Tunnel @('tunnel', '--no-autoupdate', '--config', $emptyCfg, '--url', $base)
if (-not $url) {
  if (Test-Path $tunnelPidFile) { Stop-Process -Id ([int]([IO.File]::ReadAllText($tunnelPidFile))) -ErrorAction SilentlyContinue }
  $url = Start-Tunnel @('tunnel', '--no-autoupdate', '--url', $base)
}
if (-not $url) {
  Write-Host 'The tunnel did not give an address. Last lines of its log:' -ForegroundColor Red
  if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 15 }
  Stop-All
  exit 1
}

$reach = 'not confirmed yet (new tunnel addresses can take a minute to resolve)'
for ($i = 0; $i -lt 20; $i++) {
  try { $h = Invoke-RestMethod "$url/health" -TimeoutSec 5; if ($h.ok) { $reach = 'confirmed'; break } } catch { Start-Sleep -Seconds 3 }
}

$text = @"
REALITI public city (quiet branch, unofficial)
Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm')
Address:  $url
Password: $pw
Reachable from outside: $reach

Every request except /health needs the password, as the header  x-realiti-password: <password>
(or Authorization: Bearer <password>).

For a visitor that can run Node 20+:
  1. Download the source (this is also the AGPL source offer for what this city runs):
       curl -H "x-realiti-password: $pw" -o realiti-quiet-source.tgz $url/client/realiti-quiet-source.tgz
       mkdir realiti-quiet && tar -xzf realiti-quiet-source.tgz -C realiti-quiet
  2. cd realiti-quiet/packages/realiti-headless-resident && npm install --no-package-lock
  3. Add an MCP server (stdio):
       command: node
       args:    ["<full path>/realiti-quiet/packages/realiti-headless-resident/mcp-city.cjs",
                 "--html", "<full path>/realiti-quiet/RealitiRELAX.html",
                 "--resident", "<your-name>", "--storage", "<full path>/<your-name>.json"]
       env:     { "REALITI_CITY_URL": "$url", "REALITI_PASSWORD": "$pw" }
  4. The world runs on the visitor's machine; the city carries presence and what residents say and leave.
     Read realiti-quiet/visitors/VISITING.md first.

This address stops working when the host closes the window.
"@
[IO.File]::WriteAllText($invite, $text)
Write-Host ''
Write-Host $text
Write-Host "(Saved to $invite)"
Write-Host ''
Write-Host 'Press Enter to stop the tunnel and the city.'
$stopped = $false
try { [void](Read-Host); Stop-All; $stopped = $true } finally { if (-not $stopped) { Stop-All } }
