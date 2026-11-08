@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run.ps1"
if errorlevel 3 goto stopped
if errorlevel 1 goto failed
echo.
echo ytube is available at http://127.0.0.1:8080
echo If no browser tab appeared, open that address manually.
goto finish
:stopped
echo.
echo ytube has stopped.
goto finish
:failed
echo.
echo ytube could not start. See the error above.
:finish
pause
