param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [string]$OutputDir = "backups",
  [string]$Label = "manual"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump was not found in PATH."
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = ($Label -replace '[^a-zA-Z0-9-_]', '-')
$outputPath = Join-Path $OutputDir "fnb_stock_${safeLabel}_${timestamp}.dump"

Write-Host "Creating PostgreSQL backup at $outputPath"
pg_dump --format=custom --file=$outputPath $DatabaseUrl

if (-not (Test-Path $outputPath)) {
  throw "Backup file was not created."
}

Write-Host "Backup completed: $outputPath"
