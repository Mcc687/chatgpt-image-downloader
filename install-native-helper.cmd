@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0native-host\install-native-helper.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Check the extension ID and try again.
)
pause
