@echo off
echo ========================================
echo MAE Dashboard - Starting Live Server
echo ========================================
echo.
echo Starting server on http://localhost:8080
echo Browser will reload automatically on file changes
echo.
echo Press Ctrl+C to stop the server
echo.
cd /d "%~dp0"
where live-server >nul 2>&1
if %errorlevel% neq 0 (
  echo live-server not found. Installing...
  npm install -g live-server
)
live-server --port=8080 --open=index.html
pause
