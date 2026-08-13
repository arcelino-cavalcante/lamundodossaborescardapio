$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Write-Step([string]$Message) {
  Write-Host "`n>> $Message" -ForegroundColor Cyan
}

function Write-Utf8NoBom([string]$Path, [string]$Content) {
  $encoding = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Find-Browser {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
  )
  return $candidates | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
}

function New-AppShortcut {
  param(
    [string]$ShortcutPath,
    [string]$TargetPath,
    [string]$WorkingDirectory,
    [string]$Description,
    [int]$WindowStyle = 1
  )

  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($ShortcutPath)
  $shortcut.TargetPath = $TargetPath
  $shortcut.WorkingDirectory = $WorkingDirectory
  $shortcut.Description = $Description
  $shortcut.WindowStyle = $WindowStyle
  $shortcut.Save()
}

try {
  if ($env:OS -ne 'Windows_NT') {
    throw 'Este instalador deve ser executado em um computador com Windows.'
  }

  $packageRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
  $sourceDirectory = Join-Path $packageRoot 'app'
  $versionFile = Join-Path $packageRoot 'VERSAO.txt'
  $packageVersion = if (Test-Path $versionFile) { (Get-Content $versionFile -Raw).Trim() } else { 'versao nao informada' }
  if (-not (Test-Path (Join-Path $sourceDirectory 'manager.js'))) {
    throw 'A pasta app do pacote esta incompleta. Extraia todo o arquivo ZIP antes de instalar.'
  }

  Write-Host "Pacote: $packageVersion" -ForegroundColor Green

  $installDirectory = Join-Path $env:LOCALAPPDATA 'LaMundoRobozinho'
  $nodeDirectory = Join-Path $installDirectory 'runtime\node'
  $nodeExe = Join-Path $nodeDirectory 'node.exe'

  Write-Step 'Copiando os arquivos do Robozinho'
  New-Item -ItemType Directory -Path $installDirectory -Force | Out-Null
  Copy-Item (Join-Path $sourceDirectory '*') $installDirectory -Recurse -Force

  if (-not (Test-Path $nodeExe)) {
    Write-Step 'Baixando o Node.js portatil (nao precisa ser instalado no Windows)'
    $nodeArch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $nodeBaseUrl = 'https://nodejs.org/dist/latest-v22.x'
    $checksums = (Invoke-WebRequest -UseBasicParsing "$nodeBaseUrl/SHASUMS256.txt").Content
    $nodeMatch = [regex]::Match($checksums, "node-v[0-9.]+-win-$nodeArch\.zip")
    if (-not $nodeMatch.Success) { throw "Nao foi encontrada uma versao do Node.js para $nodeArch." }

    $nodeArchiveName = $nodeMatch.Value
    $temporaryRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("la-mundo-node-" + [guid]::NewGuid().ToString('N'))
    $nodeArchive = Join-Path $temporaryRoot $nodeArchiveName
    $extractDirectory = Join-Path $temporaryRoot 'extraido'
    New-Item -ItemType Directory -Path $extractDirectory -Force | Out-Null
    Invoke-WebRequest -UseBasicParsing "$nodeBaseUrl/$nodeArchiveName" -OutFile $nodeArchive
    Expand-Archive -Path $nodeArchive -DestinationPath $extractDirectory -Force

    $extractedNode = Get-ChildItem $extractDirectory -Directory | Select-Object -First 1
    if (-not $extractedNode) { throw 'Nao foi possivel extrair o Node.js.' }
    New-Item -ItemType Directory -Path $nodeDirectory -Force | Out-Null
    Copy-Item (Join-Path $extractedNode.FullName '*') $nodeDirectory -Recurse -Force
    Remove-Item $temporaryRoot -Recurse -Force
  } else {
    Write-Step 'Node.js portatil ja instalado; mantendo a versao atual'
  }

  $env:Path = "$nodeDirectory;$env:Path"
  Write-Step 'Instalando as dependencias do bot'
  Push-Location $installDirectory
  try {
    & (Join-Path $nodeDirectory 'npm.cmd') ci --omit=dev --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw "O npm terminou com o codigo $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  $browserPath = Find-Browser
  if (-not $browserPath) {
    Write-Step 'Chrome ou Edge nao encontrado; tentando instalar o Google Chrome'
    $winget = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($winget) {
      & $winget.Source install --id Google.Chrome --exact --accept-package-agreements --accept-source-agreements
      $browserPath = Find-Browser
    }
  }
  if (-not $browserPath) {
    throw 'Google Chrome ou Microsoft Edge nao foi encontrado. Instale um deles e execute o instalador novamente.'
  }
  Write-Host "Navegador encontrado: $browserPath" -ForegroundColor Green

  $envFile = Join-Path $installDirectory '.env'
  if (-not (Test-Path $envFile)) {
    Write-Step 'Configuracao inicial'
    $printerIp = Read-Host 'IP da impressora [192.168.3.14]'
    if ([string]::IsNullOrWhiteSpace($printerIp)) { $printerIp = '192.168.3.14' }
    $adminNumber = Read-Host 'WhatsApp do administrador com DDI e DDD (opcional)'

    $envContent = @"
CARDAPIO_URL=https://lamundodossabores.com.br/
PIX_KEY=
PIX_HOLDER=
PIX_CITY=Garanhuns
PRINTER_IP=$printerIp
PRINTER_PORT=9100
PRINT_ENABLED=true
PRINTER_CHARS_PER_LINE=40
PRINT_SIZE=1
ADMIN_NUMBERS=$adminNumber
CHROME_PATH=$browserPath
HEADLESS=false
WHATSAPP_CLIENT_ID=la-mundo
DB_PATH=./leonus.db
TIMEZONE=America/Recife
STORE_NAME=LA MUNDO DOS SABORES
TICKET_FOOTER=É hoje que eu como mais uma fatia!
DASHBOARD_HOST=127.0.0.1
DASHBOARD_PORT=3030
DASHBOARD_AUTO_OPEN=true
"@
    Write-Utf8NoBom $envFile $envContent
  } else {
    Write-Step 'Configuracao anterior encontrada; mantendo WhatsApp, impressora e dados'
  }

  Write-Step 'Criando atalhos'
  $desktop = [Environment]::GetFolderPath('Desktop')
  $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\La Mundo dos Sabores'
  New-Item -ItemType Directory -Path $startMenu -Force | Out-Null

  $launcher = Join-Path $installDirectory 'Iniciar-Robozinho.cmd'
  New-AppShortcut (Join-Path $desktop 'Robozinho La Mundo.lnk') $launcher $installDirectory 'Inicia o bot e abre o painel La Mundo'
  New-AppShortcut (Join-Path $startMenu 'Iniciar Robozinho.lnk') $launcher $installDirectory 'Inicia o bot e abre o painel La Mundo'
  New-AppShortcut (Join-Path $startMenu 'Abrir painel.lnk') (Join-Path $installDirectory 'Abrir-Painel.cmd') $installDirectory 'Abre o painel do Robozinho'
  New-AppShortcut (Join-Path $startMenu 'Configurar Robozinho.lnk') (Join-Path $installDirectory 'Configurar-Robozinho.cmd') $installDirectory 'Edita a configuracao local'
  New-AppShortcut (Join-Path $startMenu 'Diagnostico.lnk') (Join-Path $installDirectory 'Diagnostico.cmd') $installDirectory 'Verifica o funcionamento do Robozinho'

  $autoStartAnswer = Read-Host 'Deseja iniciar o Robozinho automaticamente com o Windows? [S/n]'
  if ($autoStartAnswer -notmatch '^[Nn]') {
    $startup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    New-AppShortcut (Join-Path $startup 'Robozinho La Mundo.lnk') $launcher $installDirectory 'Inicia o bot com o Windows' 7
  }

  Write-Step 'Instalacao concluida com sucesso'
  Write-Host "Pasta instalada: $installDirectory" -ForegroundColor Green
  Write-Host 'Use o atalho Robozinho La Mundo na Area de Trabalho.' -ForegroundColor Green

  $dashboardWasRunning = $false
  try {
    $dashboardCheck = Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://127.0.0.1:3030/api/dashboard'
    $dashboardWasRunning = $dashboardCheck.StatusCode -eq 200
  } catch {}

  if ($dashboardWasRunning) {
    Write-Step 'Reiniciando o atendimento para carregar a versao nova'
    Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Method Post `
      -Headers @{ 'x-leonus-action' = 'painel-local' } `
      -Uri 'http://127.0.0.1:3030/api/bot/restart' | Out-Null
    Start-Process 'http://127.0.0.1:3030/'
  } else {
    Start-Process $launcher
  }
  exit 0
} catch {
  Write-Host "`nERRO: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'Confirme que o computador esta conectado a internet e tente novamente.' -ForegroundColor Yellow
  exit 1
}
