param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [Parameter(Mandatory = $true)]
  [string]$BackupPath
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $BackupPath)) {
  throw "Backup file not found: $BackupPath"
}

if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) {
  throw "pg_restore was not found in PATH."
}

Write-Host "Restoring PostgreSQL backup from $BackupPath"
pg_restore --clean --if-exists --no-owner --dbname=$DatabaseUrl $BackupPath
Write-Host "Restore completed."
