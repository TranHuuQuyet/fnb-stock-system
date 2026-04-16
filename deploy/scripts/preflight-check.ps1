param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging"
)

$ErrorActionPreference = "Stop"

function Read-Lines {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Missing file: $Path"
  }

  return Get-Content $Path | Where-Object {
    $_.Trim() -ne "" -and -not $_.Trim().StartsWith("#")
  }
}

function Get-KeyValueMap {
  param([string]$Path)

  $map = @{}
  foreach ($line in Read-Lines -Path $Path) {
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      $map[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $map
}

if ($Environment -eq "staging") {
  $composePath = ".env.staging.compose"
  $backendPath = "backend/.env.staging"
  $frontendPath = "frontend/.env.staging"
  $expectedDomain = "staging.fnbstore.store"
} else {
  $composePath = ".env.production.compose"
  $backendPath = "backend/.env.production"
  $frontendPath = "frontend/.env.production"
  $expectedDomain = "fnbstore.store"
}

$compose = Get-KeyValueMap -Path $composePath
$backend = Get-KeyValueMap -Path $backendPath
$frontend = Get-KeyValueMap -Path $frontendPath

$failures = New-Object System.Collections.Generic.List[string]

foreach ($requiredKey in @("APP_DOMAIN", "NEXT_PUBLIC_API_BASE_URL", "BACKEND_ENV_FILE", "FRONTEND_ENV_FILE")) {
  if (-not $compose.ContainsKey($requiredKey)) {
    $failures.Add("Missing $requiredKey in $composePath")
  }
}

foreach ($requiredKey in @("DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGIN")) {
  if (-not $backend.ContainsKey($requiredKey)) {
    $failures.Add("Missing $requiredKey in $backendPath")
  }
}

if (-not $frontend.ContainsKey("NEXT_PUBLIC_API_BASE_URL")) {
  $failures.Add("Missing NEXT_PUBLIC_API_BASE_URL in $frontendPath")
}

$allValues = @($compose.Values + $backend.Values + $frontend.Values)
foreach ($value in $allValues) {
  if ($value -match "replace-with|localhost|example.com|db-host|staging-db-host|CHANGE_ME|YOUR_") {
    $failures.Add("Placeholder value still present: $value")
  }
}

if ($compose["APP_DOMAIN"] -ne $expectedDomain) {
  $failures.Add("APP_DOMAIN should be $expectedDomain but is $($compose["APP_DOMAIN"])")
}

if ($backend["CORS_ORIGIN"] -notlike "https://$expectedDomain*") {
  $failures.Add("CORS_ORIGIN should point to https://$expectedDomain")
}

if ($frontend["NEXT_PUBLIC_API_BASE_URL"] -notlike "https://$expectedDomain/api/v1*") {
  $failures.Add("Frontend API base URL should point to https://$expectedDomain/api/v1")
}

if ($compose["NEXT_PUBLIC_API_BASE_URL"] -ne $frontend["NEXT_PUBLIC_API_BASE_URL"]) {
  $failures.Add("Compose NEXT_PUBLIC_API_BASE_URL does not match frontend env")
}

if ($failures.Count -gt 0) {
  Write-Host "Preflight check failed:" -ForegroundColor Red
  foreach ($failure in $failures) {
    Write-Host "- $failure" -ForegroundColor Red
  }
  exit 1
}

Write-Host "Preflight check passed for $Environment." -ForegroundColor Green
Write-Host "APP_DOMAIN: $($compose["APP_DOMAIN"])"
Write-Host "API Base URL: $($frontend["NEXT_PUBLIC_API_BASE_URL"])"
Write-Host "CORS_ORIGIN: $($backend["CORS_ORIGIN"])"
