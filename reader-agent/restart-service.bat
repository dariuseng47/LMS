@echo off
chcp 65001 >nul
net session >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Right-click restart-service.bat and choose "Run as administrator".
  pause
  exit /b 1
)
net stop "LMS Reader Agent"
net start "LMS Reader Agent"
pause
