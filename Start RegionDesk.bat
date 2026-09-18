@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" -Mode Launch
set "setup_result=%errorlevel%"
if not "%setup_result%"=="0" pause
exit /b %setup_result%
