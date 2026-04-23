param(
  [ValidateSet("staging", "production")]
  [string]$Environment = "staging",
  [string]$BaseUrl = "",
  [string]$OpsConfigPath = "deploy/.env.ops",
  [string]$BackupManifestPath = "",
  [int]$BackupMaxAgeHours = 0,
  [string]$AdminUsername = "",
  [string]$AdminPassword = "",
  [switch]$RequireAuth,
  [switch]$SkipBackupCheck,
  [switch]$SkipFrontend,
  [switch]$SkipReady,
  [switch]$SkipAuth,
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

function Get-DefaultBackupManifestPath {
  param(
    [hashtable]$Config,
    [string]$EnvironmentName
  )

  $backupRootDir = Get-ConfigValue -Config $Config -Key "BACKUP_ROOT_DIR" -EnvironmentName $EnvironmentName -DefaultValue "backups"
  return Join-Path (Join-Path $backupRootDir $EnvironmentName) "latest-backup.json"
}

function Test-BackupManifest {
  param(
    [string]$ManifestFile,
    [int]$MaxAgeHours
  )

  if (-not (Test-Path $ManifestFile)) {
    throw "Backup manifest not found: $ManifestFile"
  }

  $manifest = Get-Content -LiteralPath $ManifestFile -Raw | ConvertFrom-Json
  if (-not $manifest.createdAt) {
    throw "Backup manifest does not contain createdAt: $ManifestFile"
  }

  $createdAt = [datetimeoffset]::Parse([string]$manifest.createdAt)
  $ageHours = ((Get-Date).ToUniversalTime() - $createdAt.UtcDateTime).TotalHours
  if ($ageHours -gt $MaxAgeHours) {
    throw "Backup manifest is too old ($([Math]::Round($ageHours, 2))h > ${MaxAgeHours}h): $ManifestFile"
  }

  if (-not $manifest.outputPath) {
    throw "Backup manifest does not contain outputPath: $ManifestFile"
  }

  if (-not (Test-Path ([string]$manifest.outputPath))) {
    throw "Backup file from manifest does not exist: $([string]$manifest.outputPath)"
  }

  return [pscustomobject]@{
    path = $ManifestFile
    createdAt = $createdAt.UtcDateTime.ToString("o")
    ageHours = [Math]::Round($ageHours, 2)
    outputPath = [string]$manifest.outputPath
  }
}

$opsConfig = @{}
if (Test-Path $OpsConfigPath) {
  $opsConfig = Get-KeyValueMap -Path $OpsConfigPath
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = Get-ConfigValue -Config $opsConfig -Key "BASE_URL" -EnvironmentName $Environment
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
  $BaseUrl = if ($Environment -eq "production") {
    "https://fnbstore.store"
  } else {
    "https://staging.fnbstore.store"
  }
}

if ([string]::IsNullOrWhiteSpace($BackupManifestPath)) {
  $BackupManifestPath = Get-ConfigValue -Config $opsConfig -Key "BACKUP_MANIFEST_PATH" -EnvironmentName $Environment
}

if ([string]::IsNullOrWhiteSpace($BackupManifestPath)) {
  $BackupManifestPath = Get-DefaultBackupManifestPath -Config $opsConfig -EnvironmentName $Environment
}

if ($BackupMaxAgeHours -le 0) {
  $BackupMaxAgeHours = Get-ConfigInt `
    -Config $opsConfig `
    -Key "BACKUP_MAX_AGE_HOURS" `
    -EnvironmentName $Environment `
    -DefaultValue $(if ($Environment -eq "production") { 36 } else { 168 })
}

if ([string]::IsNullOrWhiteSpace($AdminUsername)) {
  $AdminUsername = Get-ConfigValue -Config $opsConfig -Key "SMOKE_ADMIN_USERNAME" -EnvironmentName $Environment
}

if ([string]::IsNullOrWhiteSpace($AdminPassword)) {
  $AdminPassword = Get-ConfigValue -Config $opsConfig -Key "SMOKE_ADMIN_PASSWORD" -EnvironmentName $Environment
}

$notifyOnSuccessEnabled = $NotifyOnSuccess -or (Get-ConfigBool -Config $opsConfig -Key "ALERT_NOTIFY_ON_SUCCESS" -EnvironmentName $Environment -DefaultValue $false)
$alertWebhookUrl = Get-ConfigValue -Config $opsConfig -Key "ALERT_WEBHOOK_URL" -EnvironmentName $Environment
$alertHeadersJson = Get-ConfigValue -Config $opsConfig -Key "ALERT_WEBHOOK_HEADERS_JSON" -EnvironmentName $Environment

$preflightScript = Join-Path $PSScriptRoot "preflight-check.ps1"
$smokeScript = Join-Path $PSScriptRoot "smoke-test.ps1"
$alertScript = Join-Path $PSScriptRoot "send-ops-alert.ps1"

$summary = [ordered]@{
  environment = $Environment
  baseUrl = $BaseUrl
  preflight = "pending"
  backup = "skipped"
  smoke = "pending"
  backupManifest = $BackupManifestPath
}

try {
  Write-Host "Running release gate for $Environment"

  & $preflightScript -Environment $Environment
  $summary.preflight = "passed"

  if (-not $SkipBackupCheck) {
    if ([string]::IsNullOrWhiteSpace($BackupManifestPath)) {
      throw "Backup manifest path is required unless -SkipBackupCheck is used."
    }

    $backupCheck = Test-BackupManifest -ManifestFile $BackupManifestPath -MaxAgeHours $BackupMaxAgeHours
    $summary.backup = "passed"
    $summary.backupAgeHours = $backupCheck.ageHours
    $summary.backupOutputPath = $backupCheck.outputPath
  }

  $smokeArguments = @{
    BaseUrl = $BaseUrl
  }

  if ($SkipFrontend) {
    $smokeArguments.SkipFrontend = $true
  }

  if ($SkipReady) {
    $smokeArguments.SkipReady = $true
  }

  if ($SkipAuth) {
    $smokeArguments.SkipAuth = $true
  } else {
    if (-not [string]::IsNullOrWhiteSpace($AdminUsername)) {
      $smokeArguments.AdminUsername = $AdminUsername
    }

    if (-not [string]::IsNullOrWhiteSpace($AdminPassword)) {
      $smokeArguments.AdminPassword = $AdminPassword
    }

    if ($RequireAuth) {
      $smokeArguments.RequireAuth = $true
    }
  }

  & $smokeScript @smokeArguments
  $summary.smoke = "passed"

  if ($notifyOnSuccessEnabled) {
    & $alertScript `
      -Title "[$Environment] Release gate passed" `
      -Message "Preflight, backup guard, and smoke test passed successfully." `
      -Severity "info" `
      -Environment $Environment `
      -Source "release-gate" `
      -WebhookUrl $alertWebhookUrl `
      -HeadersJson $alertHeadersJson `
      -DetailsJson ($summary | ConvertTo-Json -Depth 6)
  }

  Write-Host ""
  Write-Host "Release gate passed for $Environment"
} catch {
  $summary.failure = $_.Exception.Message

  & $alertScript `
    -Title "[$Environment] Release gate failed" `
    -Message $_.Exception.Message `
    -Severity "critical" `
    -Environment $Environment `
    -Source "release-gate" `
    -WebhookUrl $alertWebhookUrl `
    -HeadersJson $alertHeadersJson `
    -DetailsJson ($summary | ConvertTo-Json -Depth 6)

  throw
}
