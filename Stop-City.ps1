$data = 'C:/Users/bslik/Documents/RealitiCity-data'
if (-not (Test-Path (Join-Path $data 'city.pid'))) { Write-Host 'No background city is managed here. If you started it in a terminal, press Ctrl+C in that terminal.'; exit }
[IO.File]::WriteAllText((Join-Path $data 'city.stop'),'stop')
Write-Host 'Graceful city shutdown requested; shared records will be saved.'
