param(
  [Parameter(Mandatory = $true)]
  [string]$Title,
  [Parameter(Mandatory = $true)]
  [string]$Message,
  [ValidateSet("info", "warning", "critical")]
  [string]$Severity = "info",
  [string]$Environment = "production",
  [string]$Source = "operations",
  [string]$WebhookUrl = "",
  [string]$HeadersJson = "",
  [string]$DetailsJson = "",
  [switch]$PassThru
)

$ErrorActionPreference = "Stop"

function Convert-OptionalJson {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) {
    return $null
  }

  return $Value | ConvertFrom-Json
}

$payload = [ordered]@{
  title = $Title
  message = $Message
  severity = $Severity
  environment = $Environment
  source = $Source
  sentAt = (Get-Date).ToUniversalTime().ToString("o")
}

$details = Convert-OptionalJson -Value $DetailsJson
if ($null -ne $details) {
  $payload.details = $details
}

$result = [ordered]@{
  delivered = $false
  webhookConfigured = -not [string]::IsNullOrWhiteSpace($WebhookUrl)
  severity = $Severity
  title = $Title
  environment = $Environment
  source = $Source
  sentAt = $payload.sentAt
}

if ([string]::IsNullOrWhiteSpace($WebhookUrl)) {
  Write-Warning "Alert webhook is not configured. Skipping remote delivery for: $Title"
  if ($PassThru) {
    [pscustomobject]$result
  }
  return
}

$headers = @{}
$parsedHeaders = Convert-OptionalJson -Value $HeadersJson
if ($null -ne $parsedHeaders) {
  foreach ($property in $parsedHeaders.PSObject.Properties) {
    $headers[$property.Name] = [string]$property.Value
  }
}

Write-Host "Sending alert '$Title' to configured webhook"
Invoke-RestMethod `
  -Uri $WebhookUrl `
  -Method Post `
  -ContentType "application/json" `
  -Headers $headers `
  -Body ($payload | ConvertTo-Json -Depth 8)

$result.delivered = $true
Write-Host "Alert delivered"

if ($PassThru) {
  [pscustomobject]$result
}
