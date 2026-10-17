# Stops the public city and its tunnel if Run-Public-City's window was closed with X. (Claude, 2026-10-17)
$data = if ($env:REALITI_PUBLIC_DATA) { $env:REALITI_PUBLIC_DATA } else { (Join-Path (Split-Path $PSScriptRoot -Parent) 'public-city-data') }
$tp = Join-Path $data 'tunnel.pid'
$dp = Join-Path $data 'door.pid'
if (Test-Path $dp) { [IO.File]::WriteAllText((Join-Path $data 'door.stop'), 'stop'); Start-Sleep -Seconds 4; Stop-Process -Id ([int]([IO.File]::ReadAllText($dp))) -ErrorAction SilentlyContinue; Remove-Item $dp -ErrorAction SilentlyContinue; Write-Host 'HTTP door closed.' }
if (Test-Path $tp) { Stop-Process -Id ([int]([IO.File]::ReadAllText($tp))) -ErrorAction SilentlyContinue; Remove-Item $tp -ErrorAction SilentlyContinue; Write-Host 'Tunnel closed.' }
if (Test-Path (Join-Path $data 'city.pid')) { [IO.File]::WriteAllText((Join-Path $data 'city.stop'), 'stop'); Write-Host 'City shutdown requested; shared records will be saved.' }
else { Write-Host 'No public city is running from here.' }
