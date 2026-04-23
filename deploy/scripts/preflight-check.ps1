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

function Test-StrongSecret {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  if ($Value.Length -lt 32) {
    return $false
  }

  return $Value -notmatch "replace-with|change-me|super-secret-change-me|example.com|db-host|staging-db-host|YOUR_"
}

function Test-EmailLike {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  return $Value -match '^[^@\s]+@[^@\s]+\.[^@\s]+$'
}

function Test-FrontendApiBaseUrl {
  param(
    [string]$Value,
    [string]$ExpectedDomain
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  return $Value -eq "/api/v1" -or $Value -like "https://$ExpectedDomain/api/v1*"
}

function Test-UsesConnectionPooler {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $false
  }

  return $Value -match "pooler|pgbouncer=true"
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

foreach ($requiredKey in @("APP_DOMAIN", "LETSENCRYPT_EMAIL", "NEXT_PUBLIC_API_BASE_URL", "BACKEND_ENV_FILE", "FRONTEND_ENV_FILE")) {
  if (-not $compose.ContainsKey($requiredKey)) {
    $failures.Add("Missing $requiredKey in $composePath")
  }
}

foreach ($requiredKey in @("DATABASE_URL", "DIRECT_URL", "JWT_SECRET", "JWT_REFRESH_SECRET", "CORS_ORIGIN", "TRUST_PROXY", "ENABLE_SWAGGER", "REQUIRE_STRONG_SECRETS", "AUTH_COOKIE_SECURE", "AUTH_COOKIE_SAME_SITE")) {
  if (-not $backend.ContainsKey($requiredKey)) {
    $failures.Add("Missing $requiredKey in $backendPath")
  }
}

if (-not $frontend.ContainsKey("NEXT_PUBLIC_API_BASE_URL")) {
  $failures.Add("Missing NEXT_PUBLIC_API_BASE_URL in $frontendPath")
}

$allValues = @($compose.Values + $backend.Values + $frontend.Values)
foreach ($value in $allValues) {
  if ($value -match "replace-with|localhost|example.com|db-host|db-pooler-host|staging-db-host|staging-db-pooler-host|CHANGE_ME|YOUR_") {
    $failures.Add("Placeholder value still present: $value")
  }
}

if ($compose["APP_DOMAIN"] -ne $expectedDomain) {
  $failures.Add("APP_DOMAIN should be $expectedDomain but is $($compose["APP_DOMAIN"])")
}

if (-not (Test-EmailLike -Value $compose["LETSENCRYPT_EMAIL"])) {
  $failures.Add("LETSENCRYPT_EMAIL must be a valid email address")
}

if ($compose["BACKEND_ENV_FILE"] -ne $backendPath) {
  $failures.Add("BACKEND_ENV_FILE should point to $backendPath")
}

if ($compose["FRONTEND_ENV_FILE"] -ne $frontendPath) {
  $failures.Add("FRONTEND_ENV_FILE should point to $frontendPath")
}

if (-not (Test-Path $compose["BACKEND_ENV_FILE"])) {
  $failures.Add("BACKEND_ENV_FILE does not exist: $($compose["BACKEND_ENV_FILE"])")
}

if (-not (Test-Path $compose["FRONTEND_ENV_FILE"])) {
  $failures.Add("FRONTEND_ENV_FILE does not exist: $($compose["FRONTEND_ENV_FILE"])")
}

if ($backend["CORS_ORIGIN"] -notlike "https://$expectedDomain*") {
  $failures.Add("CORS_ORIGIN should point to https://$expectedDomain")
}

if (-not (Test-StrongSecret -Value $backend["JWT_SECRET"])) {
  $failures.Add("JWT_SECRET must be at least 32 characters and must not use a placeholder")
}

if (Test-UsesConnectionPooler -Value $backend["DIRECT_URL"]) {
  $failures.Add("DIRECT_URL must be a direct database connection and must not point to a pooler/PgBouncer endpoint")
}

if ($backend["DIRECT_URL"] -eq $backend["DATABASE_URL"] -and (Test-UsesConnectionPooler -Value $backend["DATABASE_URL"])) {
  $failures.Add("DIRECT_URL must differ from pooled DATABASE_URL so Prisma migrate can connect directly")
}

if (-not (Test-StrongSecret -Value $backend["JWT_REFRESH_SECRET"])) {
  $failures.Add("JWT_REFRESH_SECRET must be at least 32 characters and must not use a placeholder")
}

if ($backend["JWT_SECRET"] -eq $backend["JWT_REFRESH_SECRET"]) {
  $failures.Add("JWT_SECRET and JWT_REFRESH_SECRET must not be identical")
}

if ($backend["TRUST_PROXY"] -ne "1") {
  $failures.Add("TRUST_PROXY should be set to 1 behind reverse proxy")
}

if (([string]$backend["REQUIRE_STRONG_SECRETS"]).ToLowerInvariant() -ne "true") {
  $failures.Add("REQUIRE_STRONG_SECRETS should be true for staging/production")
}

if ($Environment -eq "production" -and ([string]$backend["ENABLE_SWAGGER"]).ToLowerInvariant() -ne "false") {
  $failures.Add("ENABLE_SWAGGER should be false in production")
}

if ($Environment -eq "staging" -and ([string]$backend["ENABLE_SWAGGER"]).ToLowerInvariant() -ne "true") {
  $failures.Add("ENABLE_SWAGGER should be true in staging")
}

if (([string]$backend["AUTH_COOKIE_SECURE"]).ToLowerInvariant() -ne "true") {
  $failures.Add("AUTH_COOKIE_SECURE should be true for staging/production HTTPS deployments")
}

if (@("lax", "strict", "none") -notcontains ([string]$backend["AUTH_COOKIE_SAME_SITE"]).ToLowerInvariant()) {
  $failures.Add("AUTH_COOKIE_SAME_SITE should be one of: lax, strict, none")
}

if (-not (Test-FrontendApiBaseUrl -Value $frontend["NEXT_PUBLIC_API_BASE_URL"] -ExpectedDomain $expectedDomain)) {
  $failures.Add("Frontend API base URL should be /api/v1 or https://$expectedDomain/api/v1")
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
