param(
  [switch]$Force
)

$ErrorActionPreference = "Stop"

$files = @(
  @{
    Source = ".env.production.compose.example"
    Target = ".env.production.compose"
  },
  @{
    Source = "backend/.env.production.example"
    Target = "backend/.env.production"
  },
  @{
    Source = "frontend/.env.production.example"
    Target = "frontend/.env.production"
  },
  @{
    Source = "deploy/.env.ops.example"
    Target = "deploy/.env.ops"
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
Write-Host "Production env files are ready."
Write-Host "Next steps:"
Write-Host "1. Fill real values into .env.production.compose, backend/.env.production, frontend/.env.production, deploy/.env.ops"
Write-Host "2. Run preflight and smoke gate:"
Write-Host "   powershell -ExecutionPolicy Bypass -File deploy/scripts/run-release-gate.ps1 -Environment production -RequireAuth"
Write-Host "3. Deploy production:"
Write-Host "   docker compose --env-file .env.production.compose -f docker-compose.prod.yml up -d --build"
