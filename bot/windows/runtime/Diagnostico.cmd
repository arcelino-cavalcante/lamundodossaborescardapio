@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Diagnostico do Robozinho La Mundo

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0Diagnostico.ps1"
echo.
pause
