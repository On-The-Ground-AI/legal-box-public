@echo off
REM build-app.bat — Build the OTG Legal Box Windows installer (.exe)
REM
REM This script:
REM   1. Builds the React frontend (static HTML/JS/CSS)
REM   2. Compiles the Python backend into a standalone .exe (PyInstaller)
REM   3. Packages everything into a Windows installer (.exe via NSIS)
REM
REM Prerequisites (run scripts\setup.bat first, then):
REM   pip install pyinstaller
REM   cd electron && npm install

setlocal enabledelayedexpansion

echo.
echo ================================================
echo   OTG Legal Box -- Build Windows Installer
echo ================================================
echo.

SET "SCRIPT_DIR=%~dp0"
FOR %%I IN ("%SCRIPT_DIR%..") DO SET "PROJECT_DIR=%%~fI"
SET "BACKEND_DIR=%PROJECT_DIR%\backend"
SET "FRONTEND_DIR=%PROJECT_DIR%\frontend"
SET "ELECTRON_DIR=%PROJECT_DIR%\electron"
SET "BACKEND_DIST=%PROJECT_DIR%\backend-dist"

REM ── Step 1: Build frontend ─────────────────────────────────────────────────

echo [Step 1/3] Building React frontend...
cd /d "%FRONTEND_DIR%"

IF NOT EXIST "node_modules" (
    echo   Installing npm packages...
    npm install
)

npm run build
IF ERRORLEVEL 1 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)
echo [OK] Frontend built

REM ── Step 2: Compile Python backend ────────────────────────────────────────

echo.
echo [Step 2/3] Compiling Python backend with PyInstaller...
echo   This may take 5-10 minutes on first build.
echo.
cd /d "%BACKEND_DIR%"
call venv\Scripts\activate.bat

REM Install PyInstaller if needed
python -c "import PyInstaller" >nul 2>&1
IF ERRORLEVEL 1 (
    echo   Installing PyInstaller...
    pip install pyinstaller -q
)

pyinstaller legalbox.spec --distpath "%BACKEND_DIST%" --workpath "%PROJECT_DIR%\.pyinstaller-work" --clean --noconfirm
IF ERRORLEVEL 1 (
    echo [ERROR] PyInstaller build failed.
    pause
    exit /b 1
)
echo [OK] Backend compiled

REM ── Step 3: Package with Electron ─────────────────────────────────────────

echo.
echo [Step 3/3] Packaging with Electron...
cd /d "%ELECTRON_DIR%"

IF NOT EXIST "node_modules" (
    echo   Installing Electron packages...
    npm install
)

npm run build:win
IF ERRORLEVEL 1 (
    echo [ERROR] Electron build failed.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   [OK] Build complete!
echo.
echo   Installer is in: %PROJECT_DIR%\dist-electron\
dir "%PROJECT_DIR%\dist-electron\*.exe" 2>nul
echo ================================================
echo.
pause
