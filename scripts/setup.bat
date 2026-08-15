@echo off
REM setup.bat — One-time setup for OTG Legal Box (Windows)
REM
REM Run this script ONCE to install all dependencies.
REM After setup, use start.bat to launch the app.
REM
REM Usage: Double-click setup.bat, or run in Command Prompt:
REM   cd C:\path\to\LegalBox
REM   scripts\setup.bat

echo.
echo ================================================
echo   OTG Legal Box -- Setup (Windows)
echo   One-time installation
echo ================================================
echo.

REM Get the directory this script lives in (scripts\)
SET "SCRIPT_DIR=%~dp0"
REM Parent of scripts\ = project root
FOR %%I IN ("%SCRIPT_DIR%..") DO SET "PROJECT_DIR=%%~fI"
SET "BACKEND_DIR=%PROJECT_DIR%\backend"
SET "FRONTEND_DIR=%PROJECT_DIR%\frontend"

echo Project directory: %PROJECT_DIR%
echo.

REM ── Check Python ───────────────────────────────────────────────────────────

echo Checking Python 3...
python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Python not found.
    echo   Download from: https://www.python.org/downloads/
    echo   Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%V IN ('python --version 2^>^&1') DO echo [OK] %%V

REM ── Check Node.js ──────────────────────────────────────────────────────────

echo.
echo Checking Node.js...
node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js not found.
    echo   Download from: https://nodejs.org/  (choose the LTS version)
    pause
    exit /b 1
)
FOR /F "tokens=*" %%V IN ('node --version 2^>^&1') DO echo [OK] Node.js %%V

REM ── Check Ollama ───────────────────────────────────────────────────────────

echo.
echo Checking Ollama...
ollama --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [WARNING] Ollama not found.
    echo   Download Ollama for Windows: https://ollama.com/download/windows
    echo   After installing, re-run this script OR run manually:
    echo     ollama pull gemma4:e4b
    echo.
    echo   Press any key to continue setup without Ollama...
    pause >nul
) ELSE (
    echo [OK] Ollama found
)

REM ── Python virtual environment ─────────────────────────────────────────────

echo.
echo Setting up Python virtual environment...
cd /d "%BACKEND_DIR%"

IF NOT EXIST "venv" (
    echo   Creating venv...
    python -m venv venv
    IF ERRORLEVEL 1 (
        echo [ERROR] Failed to create Python virtual environment.
        pause
        exit /b 1
    )
)

REM Activate venv
call venv\Scripts\activate.bat

REM Upgrade pip
python -m pip install --upgrade pip -q

REM Install packages
echo   Installing Python packages (this may take several minutes)...
pip install -r requirements.txt -q
IF ERRORLEVEL 1 (
    echo [ERROR] Failed to install Python packages. Check your internet connection.
    pause
    exit /b 1
)
echo [OK] Python packages installed

REM ── Download SpaCy model ───────────────────────────────────────────────────

echo.
echo Checking SpaCy English model...
python -c "import spacy; spacy.load('en_core_web_sm')" >nul 2>&1
IF ERRORLEVEL 1 (
    echo   Downloading SpaCy model...
    python -m spacy download en_core_web_sm -q
    echo [OK] SpaCy model downloaded
) ELSE (
    echo [OK] SpaCy model already installed
)

REM ── Frontend dependencies ──────────────────────────────────────────────────

echo.
echo Installing frontend packages...
cd /d "%FRONTEND_DIR%"

IF NOT EXIST "node_modules" (
    echo   Running npm install...
    npm install
    IF ERRORLEVEL 1 (
        echo [ERROR] npm install failed. Check your internet connection.
        pause
        exit /b 1
    )
)
echo [OK] Frontend packages installed

REM ── Pull Gemma model ───────────────────────────────────────────────────────

ollama --version >nul 2>&1
IF NOT ERRORLEVEL 1 (
    echo.
    echo Checking for Gemma 4 model...
    ollama list 2>nul | findstr /I "gemma4" >nul 2>&1
    IF ERRORLEVEL 1 (
        echo   Pulling gemma4:e4b (~5 GB). This may take several minutes...
        ollama pull gemma4:e4b
        echo [OK] Model downloaded
    ) ELSE (
        echo [OK] Gemma 4 model already installed
    )
)

REM ── Create data directories ────────────────────────────────────────────────

echo.
IF NOT EXIST "%PROJECT_DIR%\data\cases" mkdir "%PROJECT_DIR%\data\cases"
IF NOT EXIST "%PROJECT_DIR%\data\uploads" mkdir "%PROJECT_DIR%\data\uploads"
echo [OK] Data directories ready

REM ── Done ──────────────────────────────────────────────────────────────────

echo.
echo ================================================
echo   [OK] Setup complete!
echo.
echo   To start the app, run:
echo     scripts\start.bat
echo   Or double-click start.bat in the project folder.
echo ================================================
echo.
pause
