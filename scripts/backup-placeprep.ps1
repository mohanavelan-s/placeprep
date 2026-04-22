param(
  [string]$OutputRoot = ".\\backups",
  [switch]$IncludeDbDump,
  [switch]$IncludeCloudinaryManifest,
  [switch]$IncludeEnvFiles
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

function Import-EnvIfMissing {
  param(
    [hashtable]$Values
  )

  foreach ($entry in $Values.GetEnumerator()) {
    if (-not (Test-Path "Env:$($entry.Key)") -or [string]::IsNullOrWhiteSpace((Get-Item "Env:$($entry.Key)" -ErrorAction SilentlyContinue).Value)) {
      Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
    }
  }
}

function Test-CommandAvailable {
  param(
    [string]$Name
  )

  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-BackupFileList {
  param(
    [string]$RootPath
  )

  $excludedDirNames = @('.git', 'node_modules', 'dist', 'backups')
  $excludedDirPrefixes = @('tmp-ui-debug')
  $excludedFilePatterns = @('*.log')

  return Get-ChildItem -Path $RootPath -Recurse -File -Force | Where-Object {
    $relativePath = $_.FullName.Substring($RootPath.Length).TrimStart('\')
    $segments = $relativePath -split '\\'

    foreach ($segment in $segments) {
      if ($excludedDirNames -contains $segment) {
        return $false
      }

      foreach ($prefix in $excludedDirPrefixes) {
        if ($segment.StartsWith($prefix)) {
          return $false
        }
      }
    }

    foreach ($pattern in $excludedFilePatterns) {
      if ($_.Name -like $pattern) {
        return $false
      }
    }

    return $true
  } | Select-Object -ExpandProperty FullName
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $OutputRoot "placeprep-$timestamp"
$manifestPath = Join-Path $backupRoot "backup-manifest.json"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$serverEnvPath = Join-Path $repoRoot "server\.env"
$frontendProductionEnvPath = Join-Path $repoRoot ".env.production"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

$serverEnv = Read-EnvFile $serverEnvPath
Import-EnvIfMissing $serverEnv

$repoZip = Join-Path $backupRoot "placeprep-head.zip"
$workingCopyZip = Join-Path $backupRoot "placeprep-working-copy.zip"

git archive --format zip --output $repoZip HEAD

$workingCopyFiles = Get-BackupFileList $repoRoot
if (@($workingCopyFiles).Count -gt 0) {
  Compress-Archive -Path $workingCopyFiles -DestinationPath $workingCopyZip -CompressionLevel Optimal -Force
}

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  repoHeadZip = $repoZip
  workingCopyZip = if (Test-Path $workingCopyZip) { $workingCopyZip } else { $null }
  frontendProductionEnv = if (Test-Path $frontendProductionEnvPath) { $frontendProductionEnvPath } else { $null }
  serverEnvLoaded = Test-Path $serverEnvPath
  includeEnvFiles = [bool]$IncludeEnvFiles
  includeDbDump = [bool]$IncludeDbDump
  includeCloudinaryManifest = [bool]$IncludeCloudinaryManifest
  envFiles = @()
  databaseDump = $null
  cloudinaryManifest = $null
}

if ($IncludeEnvFiles) {
  foreach ($envFile in @($serverEnvPath, $frontendProductionEnvPath)) {
    if (Test-Path $envFile) {
      $destinationPath = Join-Path $backupRoot ([System.IO.Path]::GetFileName($envFile))
      Copy-Item -LiteralPath $envFile -Destination $destinationPath -Force
      $manifest.envFiles += $destinationPath
    }
  }
}

if ($IncludeDbDump) {
  if (-not $env:DATABASE_URL) {
    Write-Warning "DATABASE_URL is not set. Skipping database backup."
  } elseif (-not (Test-CommandAvailable "pg_dump")) {
    Write-Warning "pg_dump is not installed or not on PATH. Skipping database backup."
  } else {
    $dbDumpPath = Join-Path $backupRoot "database.sql"
    & pg_dump $env:DATABASE_URL | Out-File -FilePath $dbDumpPath -Encoding utf8
    $manifest.databaseDump = $dbDumpPath
  }
}

if ($IncludeCloudinaryManifest) {
  if (-not $env:CLOUDINARY_CLOUD_NAME -or -not $env:CLOUDINARY_API_KEY -or -not $env:CLOUDINARY_API_SECRET) {
    Write-Warning "Cloudinary credentials are not fully set. Skipping Cloudinary manifest backup."
  } else {
    $cloudinaryManifestPath = Join-Path $backupRoot "cloudinary-manifest.json"
    $cloudinaryUrl = "https://$($env:CLOUDINARY_API_KEY):$($env:CLOUDINARY_API_SECRET)@api.cloudinary.com/v1_1/$($env:CLOUDINARY_CLOUD_NAME)/resources/image/upload?max_results=500"
    try {
      $cloudinaryResponse = Invoke-RestMethod -Method Get -Uri $cloudinaryUrl
      $cloudinaryResponse | ConvertTo-Json -Depth 12 | Out-File -FilePath $cloudinaryManifestPath -Encoding utf8
      $manifest.cloudinaryManifest = $cloudinaryManifestPath
    } catch {
      Write-Warning "Cloudinary manifest export failed: $($_.Exception.Message)"
    }
  }
}

$manifest | ConvertTo-Json -Depth 8 | Out-File -FilePath $manifestPath -Encoding utf8

Write-Host "Backup created at $backupRoot"
