# Development

## Requirements

- Windows 10 or Windows 11
- Google Chrome
- Node.js 20 or newer for JavaScript syntax checks
- .NET Framework 4.x C# compiler included with Windows

## Build the native host

```powershell
powershell -ExecutionPolicy Bypass -File .\native-host\build-native-helper.ps1
```

This compiles `NativeHost.cs` into `native-host/gpt-image-downloader-host.exe`. The prebuilt executable is committed so non-developers can install the extension without a compiler step.

## Verify the project

```powershell
powershell -ExecutionPolicy Bypass -File .\verify.ps1
```

Verification checks the Manifest V3 metadata, confirms the UI and manifest versions match, runs JavaScript syntax checks, and compiles the native host to a temporary executable.

## Manual browser test

1. Load this repository folder as an unpacked extension.
2. Run `install-native-helper.cmd`.
3. Reload the extension and refresh ChatGPT.
4. Open a generated-image response with a vertical thumbnail rail.
5. Without scrolling the rail, hover the gallery and confirm the badge reports the full image count.
6. Download into a temporary folder and confirm the files are sequentially numbered.
7. Repeat with existing numeric files and confirm no file is overwritten.

## Updating for ChatGPT UI changes

Prefer stable semantics such as `data-testid`, ARIA state, and the generated-image group relationship. Avoid selectors based solely on minified class names. Verify the current live DOM because ChatGPT can change independently of this repository.
