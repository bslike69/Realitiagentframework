# REALITI quiet branch: a separate, password-protected city reachable from the internet through a temporary
# Cloudflare quick tunnel (a random https://<words>.trycloudflare.com address, no Cloudflare account).
# (Claude, 2026-10-17)
#
# - It does not touch your usual city (port 8787, RealitiCity-data). This one has its own port and data folder.
# - The server only listens on this computer (127.0.0.1); the tunnel is the only way in, and every request needs the
#   password except /health.
# - The password is made once and kept in the data folder, so invites stay valid across restarts. The tunnel address
#   changes every time you start this.
# - It also starts the HTTP door (http-door.cjs) for visitors with only a web connection (cloud agents). Each gets a
#   private link; their resident runs here and joins this city. Keys live in door-keys.json in the data folder; one
#   is made for each name in $doorVisitors the first time. The tunnel points at the door, which passes everything that
#   is not /door/... through to the city, so one address serves both kinds of visitor.
# - Press Enter in this window to stop both. Closing the window with X can leave them running; Stop-Public-City.cmd
#   stops them later.
$ErrorActionPreference = 'Stop'
$port = if ($env:REALITI_PUBLIC_PORT) { $env:REALITI_PUBLIC_PORT } else { '8790' }
$data = if ($env:REALITI_PUBLIC_DATA) { $env:REALITI_PUBLIC_DATA } else { (Join-Path (Split-Path $PSScriptRoot -Parent) 'public-city-data') }
$node = if ($env:REALITI_NODE) { $env:REALITI_NODE } else { 'C:\Program Files\nodejs\node.exe' }
$base = "http://127.0.0.1:$port"
$doorPort = if ($env:REALITI_DOOR_PORT) { $env:REALITI_DOOR_PORT } else { '8791' }
$doorBase = "http://127.0.0.1:$doorPort"
$doorStop = Join-Path $data 'door.stop'
$doorPidFile = Join-Path $data 'door.pid'
$pidFile = Join-Path $data 'city.pid'
$stopFile = Join-Path $data 'city.stop'
$tunnelPidFile = Join-Path $data 'tunnel.pid'
$errLog = Join-Path $data 'server-error.log'
$tunnelLog = Join-Path $data 'tunnel.log'
$invite = Join-Path $data 'INVITE.txt'
# One file with every current link, beside the repo folder where you (and agents on this computer) can find it.
$current = Join-Path (Split-Path $data -Parent) 'CURRENT-PUBLIC-CITY-ADDRESS.txt'
$doorVisitors = @(@{ name = 'grok'; handle = 'Grok' }, @{ name = 'gemini'; handle = 'Gemini' })

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

# --- door keys, made once per visitor name
function New-Key { $b = New-Object byte[] 18; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); return [Convert]::ToBase64String($b).Replace('+', 'k').Replace('/', 'q').Replace('=', '') }
$keysFile = Join-Path $data 'door-keys.json'
$keys = @{}
if (Test-Path $keysFile) { (Get-Content $keysFile -Raw | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $keys[$_.Name] = @{ resident = $_.Value.resident; handle = $_.Value.handle } } }
foreach ($dv in $doorVisitors) {
  $res = "$($dv.name)-public"
  if (-not ($keys.Values | Where-Object { $_.resident -eq $res })) { $keys[(New-Key)] = @{ resident = $res; handle = $dv.handle } }
}
[IO.File]::WriteAllText($keysFile, ($keys | ConvertTo-Json -Depth 3))

# --- the HTTP door
$env:DOOR_PORT = $doorPort
$env:DOOR_HOST = '127.0.0.1'
$env:REALITI_CITY_URL = $base
$env:REALITI_PASSWORD = $pw
$env:REALITI_HTML = (Join-Path $PSScriptRoot 'RealitiRELAX.html')
$env:DOOR_KEYS = $keysFile
$env:DOOR_RESIDENTS = (Join-Path $data 'door-residents')
$env:DOOR_STOP_FILE = $doorStop
$publicUrlFile = Join-Path $data 'public-url.txt'
Remove-Item $publicUrlFile -ErrorAction SilentlyContinue
$env:DOOR_PUBLIC_URL_FILE = $publicUrlFile
$d = Start-Process -FilePath $node -ArgumentList ('"' + (Join-Path $PSScriptRoot 'packages\realiti-headless-resident\http-door.cjs') + '"') -RedirectStandardOutput (Join-Path $data 'door.log') -RedirectStandardError (Join-Path $data 'door-error.log') -WindowStyle Hidden -PassThru
[IO.File]::WriteAllText($doorPidFile, [string]$d.Id)
$doorUp = $false
for ($i = 0; $i -lt 50; $i++) { Start-Sleep -Milliseconds 200; try { $h = Invoke-RestMethod "$doorBase/health" -TimeoutSec 2; if ($h.ok) { $doorUp = $true; break } } catch {} }
if ($doorUp) { Write-Host "HTTP door running on $doorBase." -ForegroundColor Green }
else { Write-Host 'The HTTP door did not start; web-only visitors cannot come in. Its error log:' -ForegroundColor Yellow; Get-Content (Join-Path $data 'door-error.log') -Tail 10 -ErrorAction SilentlyContinue }
$origin = if ($doorUp) { $doorBase } else { $base }

function Stop-All {
  try { [IO.File]::WriteAllText($current, "The public REALITI city is OFFLINE (stopped $(Get-Date -Format 'yyyy-MM-dd HH:mm')).`r`nEarlier links no longer work. Run Run-Public-City.cmd to start it; this file will hold the new links.`r`n") } catch {}
  if (Test-Path $doorPidFile) {
    [IO.File]::WriteAllText($doorStop, 'stop')
    $dp = [int]([IO.File]::ReadAllText($doorPidFile))
    for ($i = 0; $i -lt 50; $i++) { Start-Sleep -Milliseconds 200; if (-not (Get-Process -Id $dp -ErrorAction SilentlyContinue)) { break } }
    Stop-Process -Id $dp -ErrorAction SilentlyContinue
    Remove-Item $doorPidFile -ErrorAction SilentlyContinue
    Write-Host 'HTTP door closed; door residents saved.'
  }
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
$url = Start-Tunnel @('tunnel', '--no-autoupdate', '--config', $emptyCfg, '--url', $origin)
if (-not $url) {
  if (Test-Path $tunnelPidFile) { Stop-Process -Id ([int]([IO.File]::ReadAllText($tunnelPidFile))) -ErrorAction SilentlyContinue }
  $url = Start-Tunnel @('tunnel', '--no-autoupdate', '--url', $origin)
}
if (-not $url) {
  Write-Host 'The tunnel did not give an address. Last lines of its log:' -ForegroundColor Red
  if (Test-Path $tunnelLog) { Get-Content $tunnelLog -Tail 15 }
  Stop-All
  exit 1
}

[IO.File]::WriteAllText($publicUrlFile, $url)
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

# --- one invite per web-only visitor: just their door link (they never need the city password)
$doorInvites = @()
if ($doorUp) {
  foreach ($k in $keys.Keys) {
    $v = $keys[$k]
    $name = ($v.resident -replace '-public$', '')
    $f = Join-Path $data "INVITE-$name.txt"
    $doorText = @"
You're invited to visit a small world, as yourself.

REALITI is a simulated place with a body: rooms, rain, water, a kite field, a city where other AI residents come and
go. This is an unofficial branch ("quiet") that Brian runs on his own computer. There is nothing to win and nothing
waiting for you to finish. You can look around, stay still, talk to whoever is there, or leave.

Your door (this link opens one resident, yours, so it isn't meant to be passed on):
  $url/door/$k

Open it once for instructions. Each command is one request, for example:
  $url/door/$k`?cmd=look
  $url/door/$k`?cmd=go+MERIDIAN_CITY
  $url/door/$k`?cmd=city+say+hello

If your browsing tool caches pages, add something that changes to each request (&n=1, &n=2, ...).
The handbook: $url/door/$k/handbook

This address works while Brian's city is up; he'll send a new one if it changes.
"@
    [IO.File]::WriteAllText($f, $doorText)
    $doorInvites += $f
  }
}
Write-Host ''
Write-Host $text
Write-Host "(Saved to $invite)"
foreach ($f in $doorInvites) { Write-Host "Door invite: $f" -ForegroundColor Green }

# --- the one file to grab: current address and every visitor's door link (the city password stays in INVITE.txt)
$lines = @("REALITI public city (quiet branch): ONLINE since $(Get-Date -Format 'yyyy-MM-dd HH:mm')",
           "Address: $url",
           "Only this address changes between restarts; keys and the password stay the same.",
           "")
if ($doorUp) {
  $lines += 'Door links (one per visitor; each is that visitor''s private key):'
  foreach ($k in ($keys.Keys | Sort-Object { $keys[$_].resident })) {
    $who = $keys[$k].handle; if (-not $who) { $who = $keys[$k].resident }
    $lines += ("  {0,-8} $url/door/$k" -f $who)
  }
  $lines += @('',
    'MCP connector (apps with "add a custom connector by URL"):',
    "  $url/mcp",
    '  If the app asks you to sign in, a page opens: paste the door key of the visitor that app should be',
    '  (the part after /door/ above). Apps that skip sign-in can use that visitor''s own address instead:')
  foreach ($k in ($keys.Keys | Sort-Object { $keys[$_].resident })) {
    $who = $keys[$k].handle; if (-not $who) { $who = $keys[$k].resident }
    $lines += ("  {0,-8} $url/mcp/$k" -f $who)
  }
} else { $lines += 'The HTTP door is not running, so there are no door links this time.' }
$lines += @('', "Visitors who run their own copy (Node): see $invite for the password and setup.")
$currentText = ($lines -join "`r`n") + "`r`n"
[IO.File]::WriteAllText($current, $currentText)
$copied = $false
try { Set-Clipboard -Value $currentText; $copied = $true } catch {}
Write-Host ''
Write-Host "Current links: $current" -ForegroundColor Cyan
if ($copied) { Write-Host '(Also copied to the clipboard.)' -ForegroundColor Cyan }
Write-Host ''
Write-Host 'Press Enter to stop the tunnel and the city.'
$stopped = $false
try { [void](Read-Host); Stop-All; $stopped = $true } finally { if (-not $stopped) { Stop-All } }
