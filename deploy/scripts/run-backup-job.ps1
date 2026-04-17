param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "production",
  [string]$OpsConfigPath = "deploy/.env.ops",
  [string]$BackendEnvFile = "",
  [string]$Label = "scheduled",
  [switch]$ForceWeekly,
  [switch]$ForceMonthly,
  [switch]$NotifyOnSuccess
)

$ErrorActionPreference = "Stop"

function Read-Lines {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    throw "Missing file: $Path"
  }

  return Get-Content -LiteralPath $Path | Where-Object {
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

function Get-ConfigValue {
  param(
    [hashtable]$Config,
    [string]$Key,
    [string]$EnvironmentName,
    [string]$DefaultValue = ""
  )

  $environmentKey = "{0}_{1}" -f $EnvironmentName.ToUpperInvariant(), $Key
  if ($Config.ContainsKey($environmentKey) -and -not [string]::IsNullOrWhiteSpace($Config[$environmentKey])) {
    return $Config[$environmentKey]
  }

  if ($Config.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($Config[$Key])) {
    return $Config[$Key]
  }

  return $DefaultValue
}

function Get-ConfigInt {
  param(
    [hashtable]$Config,
    [string]$Key,
    [string]$EnvironmentName,
    [int]$DefaultValue
  )

  $value = Get-ConfigValue -Config $Config -Key $Key -EnvironmentName $EnvironmentName
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  $parsed = 0
  if (-not [int]::TryParse($value, [ref]$parsed)) {
    throw "Config value for $Key must be an integer. Current value: $value"
  }

  return $parsed
}

function Get-ConfigBool {
  param(
    [hashtable]$Config,
    [string]$Key,
    [string]$EnvironmentName,
    [bool]$DefaultValue = $false
  )

  $value = Get-ConfigValue -Config $Config -Key $Key -EnvironmentName $EnvironmentName
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }

  return @("1", "true", "yes", "on") -contains $value.Trim().ToLowerInvariant()
}

function Ensure-Directory {
  param([string]$Path)

  New-Item -ItemType Directory -Path $Path -Force | Out-Null
  return (Resolve-Path -LiteralPath $Path).Path
}

function Copy-BackupToTier {
  param(
    [string]$SourcePath,
    [string]$TargetDir
  )

  $resolvedTargetDir = Ensure-Directory -Path $TargetDir
  $destinationPath = Join-Path $resolvedTargetDir ([IO.Path]::GetFileName($SourcePath))
  Copy-Item -LiteralPath $SourcePath -Destination $destinationPath -Force
  return (Resolve-Path -LiteralPath $destinationPath).Path
}

function Prune-ByCount {
  param(
    [string]$Directory,
    [int]$Keep
  )

  if ($Keep -le 0 -or -not (Test-Path $Directory)) {
    return
  }

  Get-ChildItem -LiteralPath $Directory -Filter "fnb_stock_*.dump" -File |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -Skip $Keep |
    ForEach-Object {
      Write-Host "Pruning old backup: $($_.FullName)"
      Remove-Item -LiteralPath $_.FullName -Force
    }
}

function Get-BackupTierPaths {
  param(
    [string]$RootDir,
    [string]$EnvironmentName
  )

  $environmentRoot = Ensure-Directory -Path (Join-Path $RootDir $EnvironmentName)
  return @{
    root = $environmentRoot
    daily = Ensure-Directory -Path (Join-Path $environmentRoot "daily")
    weekly = Ensure-Directory -Path (Join-Path $environmentRoot "weekly")
    monthly = Ensure-Directory -Path (Join-Path $environmentRoot "monthly")
  }
}

function Test-RequiredValue {
  param(
    [string]$Name,
    [string]$Value
  )

  if ([string]::IsNullOrWhiteSpace($Value)) {
    throw "Missing required value: $Name"
  }
}

$opsConfig = @{}
if (Test-Path $OpsConfigPath) {
  $opsConfig = Get-KeyValueMap -Path $OpsConfigPath
}

if ([string]::IsNullOrWhiteSpace($BackendEnvFile)) {
  $BackendEnvFile = if ($Environment -eq "production") {
    "backend/.env.production"
  } else {
    "backend/.env.staging"
  }
}

$backendConfig = Get-KeyValueMap -Path $BackendEnvFile
$databaseUrl = $backendConfig["DATABASE_URL"]
Test-RequiredValue -Name "DATABASE_URL in $BackendEnvFile" -Value $databaseUrl

$backupRootDir = Get-ConfigValue -Config $opsConfig -Key "BACKUP_ROOT_DIR" -EnvironmentName $Environment -DefaultValue "backups"
$mirrorRootDir = Get-ConfigValue -Config $opsConfig -Key "BACKUP_MIRROR_DIR" -EnvironmentName $Environment
$manifestPath = Get-ConfigValue -Config $opsConfig -Key "BACKUP_MANIFEST_PATH" -EnvironmentName $Environment
$minimumBytes = Get-ConfigInt -Config $opsConfig -Key "BACKUP_MINIMUM_SIZE_BYTES" -EnvironmentName $Environment -DefaultValue 10240
$dailyRetention = Get-ConfigInt -Config $opsConfig -Key "BACKUP_DAILY_RETENTION" -EnvironmentName $Environment -DefaultValue 14
$weeklyRetention = Get-ConfigInt -Config $opsConfig -Key "BACKUP_WEEKLY_RETENTION" -EnvironmentName $Environment -DefaultValue 8
$monthlyRetention = Get-ConfigInt -Config $opsConfig -Key "BACKUP_MONTHLY_RETENTION" -EnvironmentName $Environment -DefaultValue 3
$weeklyDay = Get-ConfigValue -Config $opsConfig -Key "BACKUP_WEEKLY_DAY" -EnvironmentName $Environment -DefaultValue "Sunday"
$notifyOnSuccessEnabled = $NotifyOnSuccess -or (Get-ConfigBool -Config $opsConfig -Key "ALERT_NOTIFY_ON_SUCCESS" -EnvironmentName $Environment -DefaultValue $false)
$alertWebhookUrl = Get-ConfigValue -Config $opsConfig -Key "ALERT_WEBHOOK_URL" -EnvironmentName $Environment
$alertHeadersJson = Get-ConfigValue -Config $opsConfig -Key "ALERT_WEBHOOK_HEADERS_JSON" -EnvironmentName $Environment

$backupPaths = Get-BackupTierPaths -RootDir $backupRootDir -EnvironmentName $Environment
if ([string]::IsNullOrWhiteSpace($manifestPath)) {
  $manifestPath = Join-Path $backupPaths.root "latest-backup.json"
}

$backupScript = Join-Path $PSScriptRoot "backup-postgres.ps1"
$alertScript = Join-Path $PSScriptRoot "send-ops-alert.ps1"

try {
  Write-Host "Running backup job for $Environment"
  Write-Host "Using backend env: $BackendEnvFile"
  Write-Host "Backup root: $($backupPaths.root)"

  $backupResult = & $backupScript `
    -DatabaseUrl $databaseUrl `
    -OutputDir $backupPaths.daily `
    -Label "$Environment-$Label-daily" `
    -ManifestPath $manifestPath `
    -PassThru

  if ($null -eq $backupResult) {
    throw "Backup script did not return manifest data."
  }

  $dailyBackupPath = [string]$backupResult.outputPath
  if (-not (Test-Path $dailyBackupPath)) {
    throw "Backup file does not exist: $dailyBackupPath"
  }

  $backupFile = Get-Item -LiteralPath $dailyBackupPath
  if ($backupFile.Length -lt $minimumBytes) {
    throw "Backup file is smaller than expected minimum size ($minimumBytes bytes): $($backupFile.Length)"
  }

  $today = Get-Date
  $isWeeklySchedule = $ForceWeekly -or $today.DayOfWeek.ToString().Equals($weeklyDay, [System.StringComparison]::OrdinalIgnoreCase)
  $isMonthlySchedule = $ForceMonthly -or $today.Day -eq 1

  $tierCopies = [ordered]@{
    daily = $dailyBackupPath
    weekly = $null
    monthly = $null
  }

  if ($isWeeklySchedule) {
    $tierCopies.weekly = Copy-BackupToTier -SourcePath $dailyBackupPath -TargetDir $backupPaths.weekly
    Write-Host "Promoted backup to weekly tier"
  }

  if ($isMonthlySchedule) {
    $tierCopies.monthly = Copy-BackupToTier -SourcePath $dailyBackupPath -TargetDir $backupPaths.monthly
    Write-Host "Promoted backup to monthly tier"
  }

  Prune-ByCount -Directory $backupPaths.daily -Keep $dailyRetention
  Prune-ByCount -Directory $backupPaths.weekly -Keep $weeklyRetention
  Prune-ByCount -Directory $backupPaths.monthly -Keep $monthlyRetention

  $mirrorResult = [ordered]@{
    configured = -not [string]::IsNullOrWhiteSpace($mirrorRootDir)
    root = $null
    daily = $null
    weekly = $null
    monthly = $null
    manifest = $null
  }

  $mirrorManifestPath = $null
  if (-not [string]::IsNullOrWhiteSpace($mirrorRootDir)) {
    $mirrorPaths = Get-BackupTierPaths -RootDir $mirrorRootDir -EnvironmentName $Environment
    $mirrorResult.root = $mirrorPaths.root
    $mirrorResult.daily = Copy-BackupToTier -SourcePath $dailyBackupPath -TargetDir $mirrorPaths.daily

    if ($tierCopies.weekly) {
      $mirrorResult.weekly = Copy-BackupToTier -SourcePath $dailyBackupPath -TargetDir $mirrorPaths.weekly
    }

    if ($tierCopies.monthly) {
      $mirrorResult.monthly = Copy-BackupToTier -SourcePath $dailyBackupPath -TargetDir $mirrorPaths.monthly
    }

    $mirrorManifestPath = Join-Path $mirrorPaths.root "latest-backup.json"
    $mirrorResult.manifest = $mirrorManifestPath
    Write-Host "Mirrored backup to $($mirrorPaths.root)"
  }

  $finalManifest = [ordered]@{
    environment = $Environment
    label = [string]$backupResult.label
    createdAt = [string]$backupResult.createdAt
    outputPath = $dailyBackupPath
    sizeBytes = [int64]$backupResult.sizeBytes
    sha256 = [string]$backupResult.sha256
    retention = @{
      daily = $dailyRetention
      weekly = $weeklyRetention
      monthly = $monthlyRetention
    }
    promoted = @{
      weekly = [bool]$isWeeklySchedule
      monthly = [bool]$isMonthlySchedule
    }
    tierCopies = $tierCopies
    mirror = $mirrorResult
    backendEnvFile = $BackendEnvFile
  }

  $finalManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $manifestPath
  Write-Host "Final backup manifest updated: $manifestPath"

  if ($mirrorManifestPath) {
    Copy-Item -LiteralPath $manifestPath -Destination $mirrorManifestPath -Force
  }

  if ($notifyOnSuccessEnabled) {
    & $alertScript `
      -Title "[$Environment] Backup completed" `
      -Message "PostgreSQL backup completed successfully and manifest was updated." `
      -Severity "info" `
      -Environment $Environment `
      -Source "backup-job" `
      -WebhookUrl $alertWebhookUrl `
      -HeadersJson $alertHeadersJson `
      -DetailsJson ($finalManifest | ConvertTo-Json -Depth 8)
  }
} catch {
  $errorMessage = $_.Exception.Message

  & $alertScript `
    -Title "[$Environment] Backup failed" `
    -Message $errorMessage `
    -Severity "critical" `
    -Environment $Environment `
    -Source "backup-job" `
    -WebhookUrl $alertWebhookUrl `
    -HeadersJson $alertHeadersJson `
    -DetailsJson (@{
      backendEnvFile = $BackendEnvFile
      manifestPath = $manifestPath
      backupRoot = $backupPaths.root
    } | ConvertTo-Json -Depth 5)

  throw
}
