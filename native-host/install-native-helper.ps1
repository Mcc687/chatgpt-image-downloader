param(
  [string]$ExtensionId = ""
)

$ErrorActionPreference = "Stop"
$HostName = "com.gpt_image_downloader.host"
$Root = $PSScriptRoot
$HostExe = Join-Path $Root "gpt-image-downloader-host.exe"
$ManifestPath = Join-Path $Root "native-host-manifest.json"
$ExtensionRoot = Split-Path -Parent $Root

if (-not (Test-Path -LiteralPath $HostExe -PathType Leaf)) {
  throw "Native helper executable not found: $HostExe"
}
if ([String]::IsNullOrWhiteSpace($ExtensionId)) {
  $ChromeUserData = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"
  $NormalizedExtensionRoot = [System.IO.Path]::GetFullPath($ExtensionRoot).TrimEnd('\').ToLowerInvariant()
  $DetectedIds = @()
  $ProfileDirectories = @(Get-ChildItem -LiteralPath $ChromeUserData -Directory -ErrorAction SilentlyContinue | Where-Object {
    $_.Name -eq "Default" -or $_.Name -like "Profile *"
  })

  foreach ($ProfileDirectory in $ProfileDirectories) {
    $PreferencesPath = Join-Path $ProfileDirectory.FullName "Secure Preferences"
    if (-not (Test-Path -LiteralPath $PreferencesPath -PathType Leaf)) { continue }
    try {
      $Preferences = Get-Content -LiteralPath $PreferencesPath -Raw | ConvertFrom-Json
      foreach ($Setting in $Preferences.extensions.settings.PSObject.Properties) {
        $StoredPath = [string]$Setting.Value.path
        if ([String]::IsNullOrWhiteSpace($StoredPath)) { continue }
        $NormalizedStoredPath = [System.IO.Path]::GetFullPath($StoredPath).TrimEnd('\').ToLowerInvariant()
        if ($NormalizedStoredPath -eq $NormalizedExtensionRoot) {
          $DetectedIds += $Setting.Name
        }
      }
    } catch {
      continue
    }
  }

  $DetectedIds = @($DetectedIds | Sort-Object -Unique)
  if ($DetectedIds.Count -ne 1) {
    throw "Could not detect the extension ID. Load this extracted folder in chrome://extensions first, then run this installer again."
  }
  $ExtensionId = $DetectedIds[0]
}

if ($ExtensionId -notmatch "^[a-p]{32}$") {
  throw "Detected extension ID is invalid: $ExtensionId"
}

$ExpectedOrigin = "chrome-extension://$ExtensionId/"
$Manifest = [ordered]@{
  name = $HostName
  description = "GPT Image Downloader Windows Helper"
  path = $HostExe
  type = "stdio"
  allowed_origins = @($ExpectedOrigin)
}
$ManifestJson = $Manifest | ConvertTo-Json -Depth 3
[System.IO.File]::WriteAllText($ManifestPath, $ManifestJson, (New-Object System.Text.UTF8Encoding($false)))

$RegistryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\$HostName"
New-Item -Path $RegistryPath -Force | Out-Null
Set-Item -Path $RegistryPath -Value $ManifestPath

Write-Host "Native helper installed. Reload the GPT image downloader extension in Chrome." -ForegroundColor Green
Write-Host "Detected and allowed extension ID: $ExtensionId"
