@echo off
reg.exe delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.gpt_image_downloader.host" /f
echo Native helper registration removed.
pause
