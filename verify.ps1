$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

$RequiredFiles = @(
  "manifest.json",
  "content.js",
  "background.js",
  "install-native-helper.cmd",
  "native-host\NativeHost.cs",
  "native-host\gpt-image-downloader-host.exe"
)
foreach ($RelativePath in $RequiredFiles) {
  $Path = Join-Path $Root $RelativePath
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Missing required file: $RelativePath"
  }
}

$Utf8 = New-Object System.Text.UTF8Encoding($false)
$ManifestPath = Join-Path $Root "manifest.json"
$Manifest = [System.IO.File]::ReadAllText($ManifestPath, $Utf8) | ConvertFrom-Json
if ($Manifest.manifest_version -ne 3) {
  throw "manifest.json must use Manifest V3."
}

$Content = [System.IO.File]::ReadAllText((Join-Path $Root "content.js"), $Utf8)
$VersionMatch = [regex]::Match($Content, 'dataset\.extensionVersion\s*=\s*"([^"]+)"')
if (-not $VersionMatch.Success -or $VersionMatch.Groups[1].Value -ne $Manifest.version) {
  throw "content.js and manifest.json version values do not match."
}

$Node = Get-Command node -ErrorAction SilentlyContinue
if (-not $Node) {
  throw "Node.js 20 or newer is required for JavaScript checks."
}
& $Node.Source --check (Join-Path $Root "content.js")
if ($LASTEXITCODE -ne 0) { throw "content.js syntax check failed." }
& $Node.Source --check (Join-Path $Root "background.js")
if ($LASTEXITCODE -ne 0) { throw "background.js syntax check failed." }

$TemporaryExe = Join-Path ([System.IO.Path]::GetTempPath()) ("gpt-image-downloader-host-{0}.test.exe" -f [Guid]::NewGuid().ToString("N"))
try {
  & (Join-Path $Root "native-host\build-native-helper.ps1") -OutputPath $TemporaryExe
} finally {
  if (Test-Path -LiteralPath $TemporaryExe) {
    Remove-Item -LiteralPath $TemporaryExe -Force
  }
}

Write-Host "All verification checks passed for version $($Manifest.version)." -ForegroundColor Green
