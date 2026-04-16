param(
  [string]$BaseUrl = "https://fnbstore.store",
  [switch]$SkipFrontend,
  [switch]$SkipReady
)

$ErrorActionPreference = "Stop"

function Test-Endpoint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Url
  )

  Write-Host "Checking $Name -> $Url"
  $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 20

  if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
    throw "$Name failed with status $($response.StatusCode)"
  }

  Write-Host "OK: $Name ($($response.StatusCode))"
  return $response
}

$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$results = @()

if (-not $SkipFrontend) {
  $results += Test-Endpoint -Name "Frontend" -Url $normalizedBaseUrl
}

$results += Test-Endpoint -Name "Health" -Url "$normalizedBaseUrl/api/v1/health"

if (-not $SkipReady) {
  $results += Test-Endpoint -Name "Readiness" -Url "$normalizedBaseUrl/api/v1/health/ready"
}

Write-Host ""
Write-Host "Smoke test completed successfully for $normalizedBaseUrl"
