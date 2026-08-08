@echo off
chcp 65001 >nul
title Instalador do Robozinho La Mundo

echo ==========================================================
echo       INSTALADOR DO ROBOZINHO LA MUNDO DOS SABORES
echo ==========================================================
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar.ps1"
set "INSTALL_RESULT=%ERRORLEVEL%"

if not "%INSTALL_RESULT%"=="0" (
  echo.
  echo A instalacao nao foi concluida. Veja o erro acima.
  pause
  exit /b %INSTALL_RESULT%
)

echo.
echo Instalacao concluida. O Robozinho sera iniciado agora.
timeout /t 3 /nobreak >nul
exit /b 0
