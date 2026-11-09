param([int]$TimeoutSeconds = 120)
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$url = 'http://127.0.0.1:8080'

for ($seconds = 0; $seconds -lt $TimeoutSeconds; $seconds++) {
  try {
    $result = Invoke-WebRequest "$url/api/app?view=home" -UseBasicParsing -TimeoutSec 3
    if ($result.StatusCode -eq 200 -and $result.Content -match '"videos"') {
      Start-Process $url
      Write-Host "Opened ytube at $url"
      exit 0
    }
  } catch { }
  Start-Sleep -Seconds 1
}

Write-Error "ytube did not become ready at $url. Check the launcher window for the error."
exit 1
