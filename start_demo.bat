@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required. Please install Node.js 18 or newer.
  pause
  exit /b 1
)
start "" "http://localhost:8766"
node server.js
pause
