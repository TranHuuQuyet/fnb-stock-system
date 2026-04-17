param(
  [Parameter(Mandatory = $true)]
  [string]$DatabaseUrl,
  [string]$OutputDir = "backups",
  [string]$Label = "manual",
  [int]$RetentionDays = 30,
  [string]$ManifestPath = "",
  [switch]$PruneOldBackups,
  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump was not found in PATH."
}

New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$safeLabel = ($Label -replace '[^a-zA-Z0-9-_]', '-')
$outputPath = Join-Path $OutputDir "fnb_stock_${safeLabel}_${timestamp}.dump"

if ([string]::IsNullOrWhiteSpace($ManifestPath)) {
  $ManifestPath = Join-Path $OutputDir "latest-backup.json"
}

Write-Host "Creating PostgreSQL backup at $outputPath"
pg_dump --format=custom --file=$outputPath $DatabaseUrl

if (-not (Test-Path $outputPath)) {
  throw "Backup file was not created."
}

if ($PruneOldBackups) {
  $cutoff = (Get-Date).AddDays(-1 * [Math]::Abs($RetentionDays))
  Get-ChildItem -Path $OutputDir -Filter "fnb_stock_*.dump" -File | Where-Object {
    $_.LastWriteTime -lt $cutoff
  } | ForEach-Object {
    Write-Host "Removing old backup: $($_.FullName)"
    Remove-Item -LiteralPath $_.FullName -Force
  }
}

$backupFile = Get-Item -LiteralPath $outputPath
$backupHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $outputPath).Hash
$manifest = [ordered]@{
  label = $safeLabel
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  outputPath = $backupFile.FullName
  sizeBytes = $backupFile.Length
  sha256 = $backupHash
  retentionDays = [Math]::Abs($RetentionDays)
}

$manifest | ConvertTo-Json | Set-Content -LiteralPath $ManifestPath

Write-Host "Backup completed: $outputPath"
Write-Host "Backup manifest updated: $ManifestPath"

if ($PassThru) {
  [pscustomobject]$manifest
}
