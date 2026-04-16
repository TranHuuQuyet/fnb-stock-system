param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$files = @(
  @{
    Source = ".env.staging.compose.example"
    Target = ".env.staging.compose"
  },
  @{
    Source = "backend/.env.staging.example"
    Target = "backend/.env.staging"
  },
  @{
    Source = "frontend/.env.staging.example"
    Target = "frontend/.env.staging"
  }
)

foreach ($file in $files) {
  if ((Test-Path $file.Target) -and -not $Force) {
    Write-Host "Skip existing file: $($file.Target)"
    continue
  }

  Copy-Item -Path $file.Source -Destination $file.Target -Force
  Write-Host "Created: $($file.Target)"
}

Write-Host ""
Write-Host "Staging env files are ready."
Write-Host "Next steps:"
Write-Host "1. Fill real values into .env.staging.compose, backend/.env.staging, frontend/.env.staging"
Write-Host "2. Run preflight check:"
Write-Host "   powershell -ExecutionPolicy Bypass -File deploy/scripts/preflight-check.ps1 -Environment staging"
Write-Host "3. Deploy staging:"
Write-Host "   docker compose --env-file .env.staging.compose -f docker-compose.prod.yml up -d --build"
