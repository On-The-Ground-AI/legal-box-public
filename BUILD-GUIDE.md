# OTG Legal Box -- Build Guide (DMG & EXE)

This document explains how to build the OTG Legal Box desktop installer for **macOS (.dmg)** and **Windows (.exe)**. The app is a three-layer Electron application:

1. **Frontend** -- React + Vite (static HTML/JS/CSS)
2. **Backend** -- Python FastAPI compiled into a standalone binary via PyInstaller
3. **Electron Shell** -- Bundles both layers into a native desktop installer

---

## Architecture Overview

```
legal-box/
  frontend/          React app (Vite build -> frontend/dist/)
  backend/           Python FastAPI server (PyInstaller -> backend-dist/)
  electron/          Electron wrapper + electron-builder config
  scripts/
    build-app.bat    Windows build script (runs all 3 stages)
    build-app.sh     macOS/Linux build script
  .github/workflows/
    build-mac.yml      GitHub Actions workflow for macOS DMG (CI)
    build-windows.yml  GitHub Actions workflow for Windows EXE (CI)
```

**Final outputs:**
- Windows: `dist-electron/OTG-Legal-Box-{version}-win-x64.exe` (NSIS installer)
- macOS: `dist-electron/OTG-Legal-Box-{version}-mac-arm64.dmg` (Apple Silicon)

---

## Prerequisites

### Both Platforms
- **Python 3.11.x** (NOT 3.12+ or 3.14 -- dependency compatibility issues with spacy/numpy)
- **Node.js 18+** (LTS recommended, v22 tested)

### Windows-Specific
- **Windows Developer Mode enabled** -- Required for electron-builder's 7z extraction (symlink privileges). Enable via: Settings > System > For developers > Developer Mode ON
- Alternatively: Visual Studio Build Tools (if building native modules from source)

### macOS-Specific
- Xcode Command Line Tools (`xcode-select --install`)
- No Apple Developer certificate required (builds are unsigned; users right-click > Open to bypass Gatekeeper)

---

## Windows Build (.exe)

### One-Time Setup

```batch
REM 1. Create Python virtual environment (from project root)
cd backend
python -m venv venv
venv\Scripts\activate.bat

REM 2. Install Python dependencies
pip install -r requirements.txt
pip install pyinstaller

REM 3. Download SpaCy English model
python -m spacy download en_core_web_sm

REM 4. Install frontend dependencies
cd ..\frontend
npm install

REM 5. Install Electron dependencies
cd ..\electron
npm install
```

### Build

From the project root, run:

```batch
scripts\build-app.bat
```

This runs three stages:
1. `npm run build` in `frontend/` -- produces `frontend/dist/`
2. `pyinstaller legalbox.spec` in `backend/` -- produces `backend-dist/legalbox-backend/legalbox-backend.exe`
3. `npm run build:win` in `electron/` -- produces `dist-electron/*.exe`

The NSIS installer will be at: `dist-electron/OTG-Legal-Box-{version}-win-x64.exe`

### Known Issue: Symlink Error During Electron Build

If you see `ERROR: Cannot create symbolic link` during the electron-builder step, you need to enable **Windows Developer Mode** (see Prerequisites). The error occurs because electron-builder's winCodeSign archive contains macOS symlinks that 7-Zip can't create without symlink privileges.

---

## macOS Build (.dmg)

### Option A: Local Build

```bash
# 1. Setup (one-time)
cd backend
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install pyinstaller
python -m spacy download en_core_web_sm

cd ../frontend && npm install
cd ../electron && npm install

# 2. Build
./scripts/build-app.sh
```

The DMG will be at: `dist-electron/OTG-Legal-Box-{version}-mac-arm64.dmg`

### Option B: GitHub Actions (CI)

The repo includes `.github/workflows/build-mac.yml` which:
- Runs on `macos-14` (Apple Silicon runner)
- Triggers manually via "Run workflow" in the Actions tab, or on push to the `claude/improve-installation-process-40RhR` branch
- Builds an unsigned ARM64 DMG
- Uploads artifacts (downloadable for 14 days)

To use:
1. Go to the repo's **Actions** tab on GitHub
2. Select **"Build macOS DMG"**
3. Click **"Run workflow"**
4. Download the artifact from the completed run

---

## Key Configuration Files

| File | Purpose |
|------|---------|
| `electron/package.json` | electron-builder config (targets, icons, bundled resources) |
| `backend/legalbox.spec` | PyInstaller config (hidden imports, bundled data files) |
| `backend/requirements.txt` | Python dependencies |
| `frontend/package.json` | Frontend build config |
| `electron/build/entitlements.mac.plist` | macOS entitlements (JIT, unsigned memory, network) |
| `electron/build/icon.png` | App icon (used for all platforms) |

---

## Adding New Programs/Features

When adding new backend modules:

1. **Add Python deps** to `backend/requirements.txt`
2. **Add hidden imports** to `backend/legalbox.spec` (in the `hiddenimports` list) -- PyInstaller can't auto-detect all imports
3. **Add data files** to `backend/legalbox.spec` (in the `added_files` list) if you have non-Python files to bundle
4. **Add routers** to `backend/legalbox.spec` hidden imports (e.g., `'routers.new_module'`)

When adding new frontend features:
- Just develop normally; Vite handles bundling automatically

When adding new Electron resources:
- Update `extraResources` in `electron/package.json` to bundle additional files

---

## Distributing via Thumb Drive

### Windows
1. Build the EXE (see above)
2. Copy `dist-electron/OTG-Legal-Box-{version}-win-x64.exe` to the thumb drive
3. Recipient runs the installer -- it's a standard NSIS installer (Next > Next > Finish)
4. Windows SmartScreen may warn about an unsigned app -- click "More info" > "Run anyway"

### macOS
1. Build the DMG (see above)
2. Copy `dist-electron/OTG-Legal-Box-{version}-mac-arm64.dmg` to the thumb drive
3. Recipient opens the DMG and drags the app to Applications
4. On first launch: right-click the app > Open > Open (bypasses Gatekeeper for unsigned apps)

---

## Current Build Status (as of April 2026)

- **macOS DMG**: GitHub Actions workflow exists and is functional (`build-mac.yml`)
- **Windows EXE**: Build pipeline works through Steps 1-2 (frontend + PyInstaller). Step 3 (electron-builder) requires Developer Mode to be enabled on the build machine. Once Developer Mode is on, run `scripts\build-app.bat` to complete the full build.
- **Both builds are unsigned** -- no code signing certificates are configured
