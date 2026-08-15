@echo off
REM uninstall.bat — Complete removal of OTG Legal Box (Windows)
REM
REM Removes user data, logs, and downloaded AI models. The app itself is
REM removed via Settings -> Apps -> OTG Legal Box -> Uninstall (NSIS), or run
REM this script after that to clear everything the uninstaller leaves behind.

echo OTG Legal Box - uninstaller
echo ===========================

REM 1. Stop running processes
taskkill /f /im legalbox-backend.exe >nul 2>&1
taskkill /f /im "OTG Legal Box.exe" >nul 2>&1
echo Stopped Legal Box processes.

REM 2. User data (cases, index, logs, settings)
set /p CONFIRM_DATA="Delete all Legal Box user data (cases, index, logs, settings)? [y/N] "
if /i "%CONFIRM_DATA%"=="y" (
    rmdir /s /q "%APPDATA%\OTG Legal Box" 2>nul
    rmdir /s /q "%LOCALAPPDATA%\OTG Legal Box" 2>nul
    echo User data removed.
)

REM 3. AI models downloaded through Legal Box
set /p CONFIRM_MODELS="Delete downloaded AI models (frees 5-20 GB)? [y/N] "
if /i "%CONFIRM_MODELS%"=="y" (
    where ollama >nul 2>&1
    if %errorlevel%==0 (
        for /f "skip=1 tokens=1" %%m in ('ollama list 2^>nul') do (
            echo %%m | findstr /b "gemma4" >nul && ollama rm %%m 2>nul
        )
        echo Legal Box models removed from Ollama.
    ) else (
        rmdir /s /q "%USERPROFILE%\.ollama\models" 2>nul
        echo Ollama model store removed.
    )
)

echo.
echo Done. If you have not already, remove the app via
echo Settings ^> Apps ^> OTG Legal Box ^> Uninstall.
pause
