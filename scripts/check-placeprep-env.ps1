param(
  [string]$FrontendEnvPath = ".env.production",
  [string]$BackendEnvPath = "server/.env"
)

function Read-EnvFile {
  param(
    [string]$Path
  )

  $values = @{}

  if (-not (Test-Path $Path)) {
    return $values
  }

  foreach ($line in Get-Content $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $parts = $trimmed -split '=', 2
    if ($parts.Count -ne 2) {
      continue
    }

    $key = $parts[0].Trim()
    $value = $parts[1].Trim().Trim('"').Trim("'")

    if ($key) {
      $values[$key] = $value
    }
  }

  return $values
}

function Get-Value {
  param(
    [hashtable]$Values,
    [string]$Key
  )

  if ($Values.ContainsKey($Key)) {
    return [string]$Values[$Key]
  }

  return ''
}

function Test-Present {
  param(
    [string]$Value
  )

  return -not [string]::IsNullOrWhiteSpace($Value)
}

function Add-Check {
  param(
    [System.Collections.ArrayList]$Checks,
    [string]$Area,
    [string]$Key,
    [string]$Value,
    [bool]$Required = $true,
    [string]$Hint = ''
  )

  $status = if (Test-Present $Value) {
    'OK'
  } elseif ($Required) {
    'MISSING'
  } else {
    'OPTIONAL'
  }

  [void]$Checks.Add([pscustomobject]@{
    Area = $Area
    Key = $Key
    Status = $status
    Value = if (Test-Present $Value) { 'set' } else { 'empty' }
    Hint = $Hint
  })
}

$frontendEnv = Read-EnvFile $FrontendEnvPath
$backendEnv = Read-EnvFile $BackendEnvPath
$checks = New-Object System.Collections.ArrayList
$warnings = New-Object System.Collections.ArrayList
$frontendApi = Get-Value $frontendEnv 'VITE_API_URL'
$clientUrl = Get-Value $backendEnv 'CLIENT_URL'
$clientUrls = Get-Value $backendEnv 'CLIENT_URLS'
$resolvedClientUrls = if (Test-Present $clientUrls) { $clientUrls } else { $clientUrl }
$appUrl = Get-Value $backendEnv 'APP_URL'
$resolvedAppUrl = if (Test-Present $appUrl) { $appUrl } else { $clientUrl }

Add-Check -Checks $checks -Area 'frontend' -Key 'VITE_API_URL' -Value $frontendApi -Hint 'Must end with /api and point to the deployed backend.'

Add-Check -Checks $checks -Area 'backend-core' -Key 'DATABASE_URL' -Value (Get-Value $backendEnv 'DATABASE_URL') -Hint 'Required for PostgreSQL.'
Add-Check -Checks $checks -Area 'backend-core' -Key 'JWT_SECRET' -Value (Get-Value $backendEnv 'JWT_SECRET') -Hint 'Use a long random secret in production.'
Add-Check -Checks $checks -Area 'backend-core' -Key 'CLIENT_URLS or CLIENT_URL' -Value $resolvedClientUrls -Hint 'Include every allowed frontend origin.'
Add-Check -Checks $checks -Area 'backend-core' -Key 'APP_URL or CLIENT_URL' -Value $resolvedAppUrl -Hint 'Used in invite links and app-facing URLs.'

Add-Check -Checks $checks -Area 'ai' -Key 'OPENAI_API_KEY' -Value (Get-Value $backendEnv 'OPENAI_API_KEY') -Required $false -Hint 'Needed only for AI features.'
Add-Check -Checks $checks -Area 'uploads' -Key 'CLOUDINARY_CLOUD_NAME' -Value (Get-Value $backendEnv 'CLOUDINARY_CLOUD_NAME') -Required $false -Hint 'Strongly recommended for production file storage.'
Add-Check -Checks $checks -Area 'uploads' -Key 'CLOUDINARY_API_KEY' -Value (Get-Value $backendEnv 'CLOUDINARY_API_KEY') -Required $false -Hint 'Required with Cloudinary.'
Add-Check -Checks $checks -Area 'uploads' -Key 'CLOUDINARY_API_SECRET' -Value (Get-Value $backendEnv 'CLOUDINARY_API_SECRET') -Required $false -Hint 'Required with Cloudinary.'

Add-Check -Checks $checks -Area 'email' -Key 'SMTP_HOST' -Value (Get-Value $backendEnv 'SMTP_HOST') -Required $false -Hint 'Needed for email delivery.'
Add-Check -Checks $checks -Area 'email' -Key 'SMTP_PORT' -Value (Get-Value $backendEnv 'SMTP_PORT') -Required $false -Hint 'Usually 587 or 465.'
Add-Check -Checks $checks -Area 'email' -Key 'SMTP_FROM' -Value (Get-Value $backendEnv 'SMTP_FROM') -Required $false -Hint 'Visible sender address.'
Add-Check -Checks $checks -Area 'web-push' -Key 'WEB_PUSH_PUBLIC_KEY' -Value (Get-Value $backendEnv 'WEB_PUSH_PUBLIC_KEY') -Required $false -Hint 'Needed for browser push.'
Add-Check -Checks $checks -Area 'web-push' -Key 'WEB_PUSH_PRIVATE_KEY' -Value (Get-Value $backendEnv 'WEB_PUSH_PRIVATE_KEY') -Required $false -Hint 'Needed for browser push.'
Add-Check -Checks $checks -Area 'web-push' -Key 'WEB_PUSH_SUBJECT' -Value (Get-Value $backendEnv 'WEB_PUSH_SUBJECT') -Required $false -Hint 'Use mailto:you@example.com or a valid URL.'

if ((Test-Present $frontendApi) -and (-not $frontendApi.TrimEnd('/').EndsWith('/api'))) {
  [void]$warnings.Add('VITE_API_URL should normally end with /api.')
}

$jwtSecret = Get-Value $backendEnv 'JWT_SECRET'
if ($jwtSecret -match 'change-this|your_super_secret|jwt_key') {
  [void]$warnings.Add('JWT_SECRET looks like a placeholder. Rotate it before production use.')
}

if ((Test-Present $resolvedClientUrls) -and ($resolvedClientUrls -match 'vercel\.app')) {
  [void]$warnings.Add('CLIENT_URLS still includes a vercel.app origin. Update it if you move the frontend.')
}

if ((Test-Present $resolvedAppUrl) -and ($resolvedAppUrl -match 'vercel\.app')) {
  [void]$warnings.Add('APP_URL still points at Vercel. Update it after migration.')
}

$webPushPublicKey = Get-Value $backendEnv 'WEB_PUSH_PUBLIC_KEY'
$webPushPrivateKey = Get-Value $backendEnv 'WEB_PUSH_PRIVATE_KEY'
if ((Test-Present $webPushPublicKey) -xor (Test-Present $webPushPrivateKey)) {
  [void]$warnings.Add('WEB_PUSH_PUBLIC_KEY and WEB_PUSH_PRIVATE_KEY should be set together.')
}

$allowPublicSignup = Get-Value $backendEnv 'ALLOW_PUBLIC_SIGNUP'
if ($allowPublicSignup -eq 'true') {
  [void]$warnings.Add('ALLOW_PUBLIC_SIGNUP is enabled.')
}

$missingRequired = @($checks | Where-Object { $_.Status -eq 'MISSING' })

Write-Host ''
Write-Host 'PlacePrep environment check'
Write-Host '--------------------------'
Write-Host "Frontend env file: $FrontendEnvPath"
Write-Host "Backend env file:  $BackendEnvPath"
Write-Host ''

$checks | Sort-Object Area, Key | Format-Table -AutoSize

if ($warnings.Count -gt 0) {
  Write-Host ''
  Write-Host 'Warnings'
  Write-Host '--------'
  foreach ($warning in $warnings) {
    Write-Host "- $warning"
  }
}

Write-Host ''
if ($missingRequired.Count -gt 0) {
  Write-Host "Result: FAIL ($($missingRequired.Count) required value(s) missing)"
  exit 1
}

Write-Host 'Result: PASS'
