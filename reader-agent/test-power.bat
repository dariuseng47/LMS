@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p READER_IP=Reader IP [192.168.1.250]: 
if "%READER_IP%"=="" set READER_IP=192.168.1.250
set /p READER_PORT=Reader Port [27011]: 
if "%READER_PORT%"=="" set READER_PORT=27011
set /p POWER=Set power dBm 0-30 (blank = read only): 
node test-reader.js %READER_IP% %READER_PORT% power %POWER%
pause
