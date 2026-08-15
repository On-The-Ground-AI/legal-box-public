@echo off
REM start.bat — Launch OTG Legal Box (Windows)
REM
REM Prerequisites: Run scripts\setup.bat first (one time only).
REM
REM Usage: Double-click this file, or run from Command Prompt:
REM   scripts\start.bat

echo.
echo ================================================
echo   OTG Legal Box
echo   Local AI Assistant for Singapore Law Firms
echo ================================================
echo.

REM ── Locate directories ─────────────────────────────────────────────────────

SET "SCRIPT_DIR=%~dp0"
FOR %%I IN ("%SCRIPT_DIR%..") DO SET "PROJECT_DIR=%%~fI"
SET "BACKEND_DIR=%PROJECT_DIR%\backend"
SET "FRONTEND_DIR=%PROJECT_DIR%\frontend"

REM ── Check prerequisites ────────────────────────────────────────────────────

echo Checking requirements...

python --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Python not found. Run scripts\setup.bat first.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%V IN ('python --version 2^>^&1') DO echo [OK] %%V

node --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERROR] Node.js not found. Run scripts\setup.bat first.
    pause
    exit /b 1
)
FOR /F "tokens=*" %%V IN ('node --version 2^>^&1') DO echo [OK] Node.js %%V

IF NOT EXIST "%BACKEND_DIR%\venv" (
    echo [ERROR] Python environment not set up. Run scripts\setup.bat first.
    pause
    exit /b 1
)

IF NOT EXIST "%FRONTEND_DIR%\node_modules" (
    echo [ERROR] Frontend packages not installed. Run scripts\setup.bat first.
    pause
    exit /b 1
)

ollama --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo [WARNING] Ollama not installed. AI features will not work.
    echo   Install from: https://ollama.com/download/windows
) ELSE (
    echo [OK] Ollama found
)

echo.

REM ── Start Ollama ───────────────────────────────────────────────────────────

ollama --version >nul 2>&1
IF NOT ERRORLEVEL 1 (
    REM Check if Ollama is already running
    curl -s http://localhost:11434 >nul 2>&1
    IF ERRORLEVEL 1 (
        echo Starting Ollama...
        start /B "" ollama serve
        timeout /t 3 /nobreak >nul
        echo [OK] Ollama started
    ) ELSE (
        echo [OK] Ollama already running
    )
)

echo.

REM ── Start the backend ──────────────────────────────────────────────────────

echo Starting backend (port 8000)...
cd /d "%BACKEND_DIR%"
call venv\Scripts\activate.bat

REM Start uvicorn in a new window
start "OTG Legal Box - Backend" /MIN cmd /c "call venv\Scripts\activate.bat && uvicorn main:app --host 127.0.0.1 --port 8000 --log-level warning > \"%PROJECT_DIR%\backend.log\" 2>&1"

REM Wait for backend to be ready (poll up to 60 seconds — cold-start chromadb + model load)
SET BACKEND_READY=0
FOR /L %%i IN (1,1,60) DO (
    IF !BACKEND_READY! == 0 (
        curl -s http://localhost:8000/api/health >nul 2>&1
        IF NOT ERRORLEVEL 1 (
            SET BACKEND_READY=1
        ) ELSE (
            timeout /t 1 /nobreak >nul
        )
    )
)

IF %BACKEND_READY% == 0 (
    echo [ERROR] Backend failed to start. Check %PROJECT_DIR%\backend.log
    pause
    exit /b 1
)
echo [OK] Backend running at http://localhost:8000

REM ── Start the frontend ─────────────────────────────────────────────────────

echo.
echo Starting frontend (port 3000)...
cd /d "%FRONTEND_DIR%"

REM Start vite in a new window
start "OTG Legal Box - Frontend" /MIN cmd /c "npm run dev -- --open > \"%PROJECT_DIR%\frontend.log\" 2>&1"

timeout /t 3 /nobreak >nul
echo [OK] Frontend starting at http://localhost:3000

echo.
echo ================================================
echo   [OK] OTG Legal Box is running!
echo.
echo   Open your browser: http://localhost:3000
echo.
echo   Logs:
echo     %PROJECT_DIR%\backend.log
echo     %PROJECT_DIR%\frontend.log
echo.
echo   Close the Backend and Frontend windows to stop.
echo ================================================
echo.
pause
