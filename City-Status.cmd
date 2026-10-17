@echo off
powershell.exe -NoProfile -Command "Invoke-RestMethod http://127.0.0.1:8787/city | ConvertTo-Json -Depth 5"
pause
