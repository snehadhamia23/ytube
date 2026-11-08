@echo off
cd /d "%~dp0ytube-app"
docker compose up --build -d
if errorlevel 1 goto failed
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ytube-app\scripts\open-when-ready.ps1"
if errorlevel 1 goto failed
echo ytube is available at http://127.0.0.1:8080
goto finish
:failed
echo ytube could not start. See the error above.
:finish
pause
