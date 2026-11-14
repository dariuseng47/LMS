@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node.js LTS from https://nodejs.org then run again.
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Please paste DEVICE_TOKEN into .env, save, then run start.bat again.
  notepad .env
  exit /b 0
)
if not exist node_modules (
  echo Installing packages...
  call npm install --omit=dev
)
node agent.js
pause
