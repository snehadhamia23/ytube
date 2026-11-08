$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-Location -LiteralPath $PSScriptRoot

function Test-PortInUse {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect('127.0.0.1', 8080)
    return $true
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (Test-PortInUse) {
  if (Get-Command docker -ErrorAction SilentlyContinue) {
    $ytubeContainer = docker compose ps -q ytube 2>$null
    if ($LASTEXITCODE -eq 0 -and $ytubeContainer) {
      Write-Host 'Stopping the ytube Docker container before starting the local app…'
      docker compose down
      if ($LASTEXITCODE -ne 0) { throw 'Could not stop the ytube Docker container.' }
    }
  }
  if (Test-PortInUse) {
    throw 'Port 8080 is in use. Close the other app or ytube launcher using that port, then run this file again.'
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.13 or newer first.' }
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) { throw 'npm is required.' }

$version = [Version]((node --version).TrimStart('v'))
if ($version -lt [Version]'22.13.0') { throw 'ytube needs Node.js 22.13 or newer.' }

$sha = [System.Security.Cryptography.SHA256]::Create()
$lockStream = [System.IO.File]::OpenRead((Join-Path $PSScriptRoot 'package-lock.json'))
try {
  $lockHash = [BitConverter]::ToString($sha.ComputeHash($lockStream)).Replace('-', '')
} finally {
  $lockStream.Dispose()
  $sha.Dispose()
}
$stamp = 'node_modules/.ytube-lock-hash'
if (-not (Test-Path -LiteralPath $stamp) -or (Get-Content -LiteralPath $stamp -Raw).Trim() -ne $lockHash) {
  Write-Host 'Installing ytube dependencies…'
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
  Set-Content -LiteralPath $stamp -Value $lockHash
}

Write-Host 'Building ytube…'
npm run build
if ($LASTEXITCODE -ne 0) { throw 'ytube build failed.' }

$helper = Join-Path $PSScriptRoot 'scripts\open-when-ready.ps1'
Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $helper + '"')) -WindowStyle Hidden
Write-Host 'Starting ytube. Your browser will open when it is ready.'
node scripts/self-host.mjs --host 127.0.0.1 --port 8080 --state .wrangler/state
if ($LASTEXITCODE -ne 0) { throw 'ytube stopped with an error.' }
Write-Host 'ytube stopped.'
exit 3
