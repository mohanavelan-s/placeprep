param(
  [string]$OutputRoot = ".\\backups",
  [switch]$IncludeDbDump,
  [switch]$IncludeCloudinaryManifest
)

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupRoot = Join-Path $OutputRoot "placeprep-$timestamp"
$repoSnapshotDir = Join-Path $backupRoot "repo"
$manifestPath = Join-Path $backupRoot "backup-manifest.json"

New-Item -ItemType Directory -Force -Path $repoSnapshotDir | Out-Null

$repoZip = Join-Path $backupRoot "placeprep-repo.zip"
git archive --format zip --output $repoZip HEAD

$manifest = [ordered]@{
  createdAt = (Get-Date).ToString("o")
  repoZip = $repoZip
  includeDbDump = [bool]$IncludeDbDump
  includeCloudinaryManifest = [bool]$IncludeCloudinaryManifest
  databaseDump = $null
  cloudinaryManifest = $null
}

if ($IncludeDbDump) {
  if (-not $env:DATABASE_URL) {
    Write-Warning "DATABASE_URL is not set. Skipping database backup."
  } else {
    $dbDumpPath = Join-Path $backupRoot "database.sql"
    pg_dump $env:DATABASE_URL | Out-File -FilePath $dbDumpPath -Encoding utf8
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
