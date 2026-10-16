param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Source = Join-Path $Root "NativeHost.cs"
if ([String]::IsNullOrWhiteSpace($OutputPath)) {
  $OutputPath = Join-Path $Root "gpt-image-downloader-host.exe"
}

$CompilerCandidates = @(
  (Join-Path $env:WINDIR "Microsoft.NET\Framework64\v4.0.30319\csc.exe"),
  (Join-Path $env:WINDIR "Microsoft.NET\Framework\v4.0.30319\csc.exe")
)
$Compiler = $CompilerCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
if (-not $Compiler) {
  throw "The .NET Framework C# compiler was not found."
}

& $Compiler /nologo /target:exe /optimize+ "/out:$OutputPath" /reference:System.Web.Extensions.dll /reference:System.Windows.Forms.dll $Source
if ($LASTEXITCODE -ne 0) {
  throw "Native host compilation failed with exit code $LASTEXITCODE."
}

$Hash = Get-FileHash -LiteralPath $OutputPath -Algorithm SHA256
Write-Host "Built: $OutputPath" -ForegroundColor Green
Write-Host "SHA256: $($Hash.Hash)"
