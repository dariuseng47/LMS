@echo off
chcp 65001 >nul
sc query lmsreaderagent.exe | findstr /i "STATE"
if errorlevel 1 echo Service "LMS Reader Agent" is not installed.
echo.
echo Startup type / recovery:
sc qc lmsreaderagent.exe | findstr /i "START_TYPE"
sc qfailure lmsreaderagent.exe | findstr /i "RESTART"
pause
