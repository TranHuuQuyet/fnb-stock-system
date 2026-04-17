param(
  [string]$BaseUrl = "https://fnbstore.store",
  [switch]$SkipFrontend,
  [switch]$SkipReady,
  [string]$AdminUsername = "",
  [string]$AdminPassword = "",
  [switch]$SkipAuth,
  [switch]$RequireAuth
)

$ErrorActionPreference = "Stop"

function Read-JsonBody {
  param([Microsoft.PowerShell.Commands.WebResponseObject]$Response)

  if ([string]::IsNullOrWhiteSpace($Response.Content)) {
    throw "Response body was empty."
  }

  return $Response.Content | ConvertFrom-Json
}

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

function Invoke-AuthSmoke {
  param(
    [string]$NormalizedBaseUrl,
    [string]$Username,
    [string]$Password
  )

  if ([string]::IsNullOrWhiteSpace($Username) -or [string]::IsNullOrWhiteSpace($Password)) {
    if ($RequireAuth) {
      throw "Admin credentials are required for auth smoke test."
    }

    Write-Warning "Skipping auth smoke test because admin credentials were not provided."
    return
  }

  $loginPayload = @{
    username = $Username
    password = $Password
  } | ConvertTo-Json

  Write-Host "Checking auth login -> $NormalizedBaseUrl/api/v1/auth/login"
  $loginResponse = Invoke-WebRequest `
    -Uri "$NormalizedBaseUrl/api/v1/auth/login" `
    -Method Post `
    -ContentType "application/json" `
    -Body $loginPayload `
    -UseBasicParsing `
    -TimeoutSec 20 `
    -SessionVariable authSession

  if ($loginResponse.StatusCode -lt 200 -or $loginResponse.StatusCode -ge 300) {
    throw "Auth login failed with status $($loginResponse.StatusCode)"
  }

  $loginBody = Read-JsonBody -Response $loginResponse
  if (-not $loginBody.success) {
    throw "Auth login did not return a success envelope."
  }

  Write-Host "Checking auth session -> $NormalizedBaseUrl/api/v1/auth/me"
  $meResponse = Invoke-WebRequest `
    -Uri "$NormalizedBaseUrl/api/v1/auth/me" `
    -UseBasicParsing `
    -TimeoutSec 20 `
    -WebSession $authSession

  if ($meResponse.StatusCode -lt 200 -or $meResponse.StatusCode -ge 300) {
    throw "Auth session validation failed with status $($meResponse.StatusCode)"
  }

  $meBody = Read-JsonBody -Response $meResponse
  if (-not $meBody.success) {
    throw "Auth session validation did not return a success envelope."
  }

  if ([string]$meBody.data.username -ne $Username) {
    throw "Auth session validation returned unexpected username: $([string]$meBody.data.username)"
  }

  Write-Host "Checking auth logout -> $NormalizedBaseUrl/api/v1/auth/logout"
  $logoutResponse = Invoke-WebRequest `
    -Uri "$NormalizedBaseUrl/api/v1/auth/logout" `
    -Method Post `
    -UseBasicParsing `
    -TimeoutSec 20 `
    -WebSession $authSession

  if ($logoutResponse.StatusCode -lt 200 -or $logoutResponse.StatusCode -ge 300) {
    throw "Auth logout failed with status $($logoutResponse.StatusCode)"
  }

  Write-Host "Checking auth session revoked -> $NormalizedBaseUrl/api/v1/auth/me"
  try {
    Invoke-WebRequest `
      -Uri "$NormalizedBaseUrl/api/v1/auth/me" `
      -UseBasicParsing `
      -TimeoutSec 20 `
      -WebSession $authSession | Out-Null

    throw "Auth session still works after logout."
  } catch {
    $statusCode = $null
    if ($null -ne $_.Exception.Response) {
      $statusCode = $_.Exception.Response.StatusCode.value__
    }

    if ($statusCode -ne 401) {
      throw
    }
  }

  Write-Host "OK: Auth login/me/logout/session-revoke"
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

if (-not $SkipAuth) {
  Invoke-AuthSmoke -NormalizedBaseUrl $normalizedBaseUrl -Username $AdminUsername -Password $AdminPassword
}

Write-Host ""
Write-Host "Smoke test completed successfully for $normalizedBaseUrl"
