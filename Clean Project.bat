@echo off
setlocal
echo Close any tests and packaged test apps before cleaning.
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\clean.ps1" %*
set "clean_result=%errorlevel%"
pause
exit /b %clean_result%
