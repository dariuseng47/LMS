@echo off
chcp 65001 >nul
cd /d "%~dp0"
net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Right-click uninstall-service.bat and choose "Run as administrator".
  pause
  exit /b 1
)
node uninstall-service.js
pause
