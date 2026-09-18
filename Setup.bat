@echo off
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\setup.ps1" -Mode Setup
set "setup_result=%errorlevel%"
if /I not "%~1"=="--no-pause" pause
exit /b %setup_result%
