@echo off
REM usb-update.bat — Apply an OTG Legal Box update from a USB drive (Windows)
REM
REM HOW TO USE (for the person doing the update):
REM
REM   1. Prepare the USB drive:
REM      - Create a folder called "legalbox-update" on the USB drive
REM      - Copy the new app files into it (same structure as the project)
REM      - If updating the AI model, copy the new .gguf file into a "models\" subfolder
REM
REM   2. Plug the USB drive into the computer
REM   3. Run this script: scripts\usb-update.bat
REM   4. The script finds the USB automatically and applies the update
REM   5. Restart the app
REM
REM NO INTERNET REQUIRED. This script never contacts any external server.
REM
REM What it updates:
REM   - Application code (backend\, frontend\dist, electron\)
REM   - AI model files (if included on the USB)
REM   - Python packages (if requirements.txt changed)
REM
REM What it NEVER changes automatically:
REM   - Your case database (data\ folder) — your data is always preserved
REM   - Your settings (config files) — preserved unless explicitly included

setlocal enabledelayedexpansion

SET "SCRIPT_DIR=%~dp0"
FOR %%I IN ("%SCRIPT_DIR%..") DO SET "PROJECT_DIR=%%~fI"
SET "UPDATE_FOLDER_NAME=legalbox-update"
SET "UPDATE_SOURCE="

echo.
echo ====================================================
echo   OTG Legal Box -- USB Offline Update
echo ====================================================
echo.
echo   Your data (cases, settings) is NEVER deleted.
echo.

REM ── Find the USB drive ────────────────────────────────────────────────────────
REM Scan all drive letters D: through Z: for the update folder

FOR %%D IN (D E F G H I J K L M N O P Q R S T U V W X Y Z) DO (
    IF EXIST "%%D:\%UPDATE_FOLDER_NAME%" (
        SET "UPDATE_SOURCE=%%D:\%UPDATE_FOLDER_NAME%"
        echo Found update on drive: %%D:\
        GOTO :FOUND
    )
)

echo [ERROR] No USB update found.
echo.
echo Make sure your USB drive is plugged in and contains a folder named:
echo   %UPDATE_FOLDER_NAME%\
echo.
echo Expected structure on the USB drive:
echo   %UPDATE_FOLDER_NAME%\
echo   +-- version.txt          (e.g. 1.2.0)
echo   +-- backend\             (updated Python files, optional)
echo   +-- frontend\dist\       (updated built frontend, optional)
echo   +-- models\              (updated AI model files, optional)
echo   +-- CHANGELOG.txt        (what changed in this update)
echo.
pause
exit /b 1

:FOUND

REM ── Read version info ─────────────────────────────────────────────────────────

SET "NEW_VERSION="
IF EXIST "%UPDATE_SOURCE%\version.txt" (
    SET /P NEW_VERSION=<"%UPDATE_SOURCE%\version.txt"
    echo Update version: %NEW_VERSION%
)

IF EXIST "%UPDATE_SOURCE%\CHANGELOG.txt" (
    echo.
    echo What's new in this update:
    echo ----------------------------------------
    type "%UPDATE_SOURCE%\CHANGELOG.txt"
    echo ----------------------------------------
    echo.
)

REM ── Confirm before applying ───────────────────────────────────────────────────

echo Ready to apply update to: %PROJECT_DIR%
echo.
SET /P CONFIRM=Apply update now? [y/N]:
IF /I NOT "%CONFIRM%"=="y" (
    echo Update cancelled.
    pause
    exit /b 0
)

echo.

REM ── Back up current version ───────────────────────────────────────────────────

REM Get timestamp for backup folder name (PowerShell replaces deprecated wmic)
FOR /F "tokens=*" %%T IN ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd-HHmmss"') DO SET "TIMESTAMP=%%T"
SET "BACKUP_DIR=%PROJECT_DIR%\..\legalbox-backup-%TIMESTAMP%"

echo Creating backup at: %BACKUP_DIR%
mkdir "%BACKUP_DIR%" 2>nul

IF EXIST "%PROJECT_DIR%\backend" (
    xcopy /E /I /Q "%PROJECT_DIR%\backend" "%BACKUP_DIR%\backend" >nul 2>&1
)
IF EXIST "%PROJECT_DIR%\frontend" (
    xcopy /E /I /Q "%PROJECT_DIR%\frontend" "%BACKUP_DIR%\frontend" >nul 2>&1
)
echo [OK] Backup created

echo.
echo Applying update...

REM ── Update backend code ───────────────────────────────────────────────────────

IF EXIST "%UPDATE_SOURCE%\backend" (
    echo   Updating backend code...
    REM Copy all backend files, skipping venv and __pycache__
    FOR /D %%F IN ("%UPDATE_SOURCE%\backend\*") DO (
        SET "DIRNAME=%%~nxF"
        IF /I NOT "!DIRNAME!"=="venv" IF /I NOT "!DIRNAME!"=="__pycache__" (
            xcopy /E /I /Y /Q "%%F" "%PROJECT_DIR%\backend\%%~nxF\" >nul 2>&1
        )
    )
    REM Copy top-level files in backend
    FOR %%F IN ("%UPDATE_SOURCE%\backend\*.*") DO (
        xcopy /Y /Q "%%F" "%PROJECT_DIR%\backend\" >nul 2>&1
    )
    echo   [OK] Backend updated
)

REM ── Update frontend dist ──────────────────────────────────────────────────────

IF EXIST "%UPDATE_SOURCE%\frontend\dist" (
    echo   Updating frontend...
    IF EXIST "%PROJECT_DIR%\frontend\dist" (
        rmdir /S /Q "%PROJECT_DIR%\frontend\dist"
    )
    xcopy /E /I /Y /Q "%UPDATE_SOURCE%\frontend\dist" "%PROJECT_DIR%\frontend\dist\" >nul 2>&1
    echo   [OK] Frontend updated
)

REM ── Update AI model files ─────────────────────────────────────────────────────

IF EXIST "%UPDATE_SOURCE%\models" (
    echo   Updating AI models...
    SET "MODEL_DIR=%PROJECT_DIR%\data\models"
    IF NOT EXIST "!MODEL_DIR!" mkdir "!MODEL_DIR!"
    xcopy /E /I /Y /Q "%UPDATE_SOURCE%\models\*" "!MODEL_DIR!\" >nul 2>&1
    echo   [OK] Models updated
)

REM ── Install updated Python packages if requirements changed ───────────────────

IF EXIST "%UPDATE_SOURCE%\backend\requirements.txt" (
    echo   Installing updated Python packages...
    cd /d "%PROJECT_DIR%\backend"
    call venv\Scripts\activate.bat
    pip install -r requirements.txt -q
    echo   [OK] Python packages updated
)

REM ── Write version file ────────────────────────────────────────────────────────

IF NOT "%NEW_VERSION%"=="" (
    echo %NEW_VERSION%>"%PROJECT_DIR%\.version"
)

REM ── Done ──────────────────────────────────────────────────────────────────────

echo.
echo ====================================================
echo   [OK] Update applied successfully!
echo.
echo   Restart the app to use the new version.
echo.
echo   Your data (cases, settings) was not modified.
echo.
IF NOT "%NEW_VERSION%"=="" echo   Version: %NEW_VERSION%
echo   Backup saved to: %BACKUP_DIR%
echo ====================================================
echo.
pause
