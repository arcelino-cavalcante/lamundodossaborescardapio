@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Robozinho La Mundo - NAO FECHE ESTA JANELA

powershell.exe -NoLogo -NoProfile -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:3030/api/dashboard' ^| Out-Null; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3030/"
  exit /b 0
)

set "PATH=%~dp0runtime\node;%PATH%"
echo ==========================================================
echo        ROBOZINHO LA MUNDO DOS SABORES
echo ==========================================================
echo.
echo O bot esta iniciando. O painel abrira automaticamente.
echo Na primeira vez, escaneie o QR Code com o WhatsApp.
echo Mantenha esta janela aberta enquanto a pizzaria funcionar.
echo.

"%~dp0runtime\node\node.exe" "%~dp0manager.js"
set "BOT_RESULT=%ERRORLEVEL%"

echo.
echo O Robozinho foi encerrado com o codigo %BOT_RESULT%.
echo Execute o Diagnostico pelo Menu Iniciar se precisar de ajuda.
pause
exit /b %BOT_RESULT%
