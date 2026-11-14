@echo off
chcp 65001 >nul
cd /d "%~dp0"
set /p READER_IP=Reader IP [192.168.1.250]: 
if "%READER_IP%"=="" set READER_IP=192.168.1.250
set /p READER_PORT=Reader Port [27011]: 
if "%READER_PORT%"=="" set READER_PORT=27011
set /p ROUND_MS=Time per antenna ms [300]: 
if "%ROUND_MS%"=="" set ROUND_MS=300
set /p TIMES=Scan how many times [5]: 
if "%TIMES%"=="" set TIMES=5
node test-reader.js %READER_IP% %READER_PORT% %ROUND_MS% %TIMES%
pause
