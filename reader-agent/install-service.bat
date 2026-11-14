@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Right-click install-service.bat and choose "Run as administrator".
  pause
  exit /b 1
)
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js LTS from https://nodejs.org then run again.
  pause
  exit /b 1
)
if not exist .env (
  echo [ERROR] .env not found. Run start.bat once first to set DEVICE_TOKEN.
  pause
  exit /b 1
)
if not exist node_modules call npm install --omit=dev
node install-service.js
pause
