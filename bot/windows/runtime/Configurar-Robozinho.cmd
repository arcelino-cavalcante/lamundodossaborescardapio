@echo off
chcp 65001 >nul
cd /d "%~dp0"

if not exist ".env" (
  echo O arquivo de configuracao ainda nao existe. Execute o instalador novamente.
  pause
  exit /b 1
)

start "" notepad.exe "%~dp0.env"
echo Depois de salvar, use Reiniciar bot no painel para aplicar as mudancas.
timeout /t 5 /nobreak >nul
