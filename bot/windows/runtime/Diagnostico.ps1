$ErrorActionPreference = 'Continue'
$botDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeExe = Join-Path $botDirectory 'runtime\node\node.exe'
$envFile = Join-Path $botDirectory '.env'

function Result([string]$Name, [bool]$Ok, [string]$Details) {
  $status = if ($Ok) { '[OK]' } else { '[FALHA]' }
  $color = if ($Ok) { 'Green' } else { 'Red' }
  Write-Host "$status $Name - $Details" -ForegroundColor $color
}

function Env-Value([string]$Name) {
  if (-not (Test-Path $envFile)) { return '' }
  $line = Get-Content $envFile | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -First 1
  if (-not $line) { return '' }
  return ($line -split '=', 2)[1].Trim()
}

Write-Host '==========================================================' -ForegroundColor Cyan
Write-Host '       DIAGNOSTICO DO ROBOZINHO LA MUNDO' -ForegroundColor Cyan
Write-Host '==========================================================' -ForegroundColor Cyan

Result 'Arquivos do bot' (Test-Path (Join-Path $botDirectory 'manager.js')) $botDirectory
Result 'Configuracao' (Test-Path $envFile) $envFile

if (Test-Path $nodeExe) {
  $nodeVersion = & $nodeExe --version
  Result 'Node.js portatil' ($LASTEXITCODE -eq 0) $nodeVersion
} else {
  Result 'Node.js portatil' $false 'Execute o instalador novamente'
}

$browserPath = Env-Value 'CHROME_PATH'
Result 'Chrome ou Edge' ($browserPath -and (Test-Path $browserPath)) $browserPath

try {
  $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 10 'https://lamundodossabores.com.br/data.json'
  Result 'Cardapio oficial' ($response.StatusCode -eq 200) "HTTP $($response.StatusCode)"
} catch {
  Result 'Cardapio oficial' $false $_.Exception.Message
}

try {
  $response = Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 'http://127.0.0.1:3030/api/dashboard'
  Result 'Painel local' ($response.StatusCode -eq 200) 'http://127.0.0.1:3030'
} catch {
  Result 'Painel local' $false 'O bot pode estar fechado'
}

$printerIp = Env-Value 'PRINTER_IP'
$printerPortText = Env-Value 'PRINTER_PORT'
$printerPort = 9100
if ($printerPortText -match '^[0-9]+$') { $printerPort = [int]$printerPortText }

if ($printerIp) {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $connection = $client.BeginConnect($printerIp, $printerPort, $null, $null)
    $connected = $connection.AsyncWaitHandle.WaitOne(3000, $false)
    if ($connected) { $client.EndConnect($connection) }
    Result 'Impressora na rede' ($connected -and $client.Connected) "$printerIp`:$printerPort"
  } catch {
    Result 'Impressora na rede' $false "$printerIp`:$printerPort"
  } finally {
    $client.Close()
  }
} else {
  Result 'Impressora na rede' $false 'IP nao configurado'
}

Write-Host "`nSe houver FALHA, tire uma foto desta tela para facilitar o atendimento." -ForegroundColor Yellow
