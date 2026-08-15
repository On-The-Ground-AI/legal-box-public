// electron/main.js — OTG Legal Box Desktop App (Electron Main Process)
//
// This file is the heart of the desktop installer.
// It starts the Python backend, waits for it to be ready,
// then opens a browser window that shows the React frontend.
//
// In production (installed app):
//   - The backend runs as a compiled binary (PyInstaller)
//   - The frontend is pre-built static HTML/JS/CSS
//   - Ollama is either bundled or checked for installation
//
// In development:
//   - The backend runs via uvicorn (requires Python venv)
//   - The frontend runs via Vite dev server on port 3000

const { app, BrowserWindow, dialog, shell, ipcMain, session } = require('electron')
const path = require('path')
const { spawn, execSync } = require('child_process')
const http = require('http')
const fs = require('fs')
const os = require('os')

// ── Single-instance lock ─────────────────────────────────────────────────────
// A second launch must not spawn a second backend on the same port — focus the
// existing window instead.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}

// ── Environment detection ──────────────────────────────────────────────────────

const IS_DEV = process.env.NODE_ENV === 'development' || !app.isPackaged
const IS_MAC = process.platform === 'darwin'
const IS_WIN = process.platform === 'win32'
const IS_LINUX = process.platform === 'linux'

const BACKEND_PORT = 8000
const FRONTEND_PORT = 3000  // Only used in dev mode
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`

let mainWindow = null
let backendProcess = null

// ── Paths ──────────────────────────────────────────────────────────────────────

function getResourcesPath() {
  // In a packaged app, resources are in app.getPath('exe') parent / Resources/
  if (IS_DEV) {
    return path.join(__dirname, '..')  // Project root in dev
  }
  if (IS_MAC) {
    return path.join(process.resourcesPath)
  }
  if (IS_WIN) {
    return path.join(path.dirname(process.execPath), 'resources')
  }
  // Linux AppImage
  return path.join(process.resourcesPath)
}

function getBackendBinaryPath() {
  const resources = getResourcesPath()
  if (IS_DEV) {
    // In dev, we'll run uvicorn directly
    return null
  }
  if (IS_WIN) {
    return path.join(resources, 'backend', 'legalbox-backend.exe')
  }
  return path.join(resources, 'backend', 'legalbox-backend')
}

function getFrontendPath() {
  if (IS_DEV) {
    return null  // Dev uses Vite server
  }
  const resources = getResourcesPath()
  return path.join(resources, 'frontend', 'dist')
}

function getDataPath() {
  // Store user data (cases, DB) in the OS user data folder — survives app updates
  return path.join(app.getPath('userData'), 'legalbox-data')
}

// ── Ollama launcher ──────────────────────────────────────────────────────────
// Makes install truly plug-and-play: if the user already runs their own
// Ollama (default port 11434) we use it; otherwise we spawn the runtime
// bundled inside the app on a private port with its models stored in the
// app's own data folder — so uninstall = delete app + data folder.

const SYSTEM_OLLAMA_URL = 'http://127.0.0.1:11434'
const BUNDLED_OLLAMA_PORT = 11435
let ollamaProcess = null
let activeOllamaUrl = SYSTEM_OLLAMA_URL

function getBundledOllamaPath() {
  const base = IS_DEV
    ? path.join(__dirname, 'vendor', 'ollama')
    : path.join(getResourcesPath(), 'ollama')
  return path.join(base, IS_WIN ? 'ollama.exe' : 'ollama')
}

function probe(url, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => resolve(res.statusCode === 200))
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve(false) })
  })
}

async function ensureOllama() {
  // 1. A system-wide Ollama already running? Use it as-is.
  if (await probe(SYSTEM_OLLAMA_URL)) {
    console.log('[Ollama] Using system Ollama on :11434')
    activeOllamaUrl = SYSTEM_OLLAMA_URL
    return true
  }

  // 2. Spawn the bundled runtime, if this build ships one.
  const bundled = getBundledOllamaPath()
  if (!fs.existsSync(bundled)) {
    console.log('[Ollama] No system Ollama and no bundled runtime — backend will report offline.')
    return false
  }

  const bundledUrl = `http://127.0.0.1:${BUNDLED_OLLAMA_PORT}`
  if (await probe(bundledUrl)) {
    activeOllamaUrl = bundledUrl
    return true
  }

  console.log('[Ollama] Starting bundled runtime on :' + BUNDLED_OLLAMA_PORT)
  const modelsDir = path.join(getDataPath(), 'models')
  fs.mkdirSync(modelsDir, { recursive: true })
  ollamaProcess = spawn(bundled, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST: `127.0.0.1:${BUNDLED_OLLAMA_PORT}`,
      OLLAMA_MODELS: modelsDir,
    },
  })
  ollamaProcess.stdout?.on('data', d => console.log('[Ollama]', d.toString().trim()))
  ollamaProcess.stderr?.on('data', d => console.log('[Ollama]', d.toString().trim()))
  ollamaProcess.on('exit', code => console.log(`[Ollama] Exited with code ${code}`))

  // Give it a few seconds to come up
  for (let i = 0; i < 15; i++) {
    if (await probe(bundledUrl)) {
      activeOllamaUrl = bundledUrl
      return true
    }
    await new Promise(r => setTimeout(r, 1000))
  }
  console.log('[Ollama] Bundled runtime did not come up in time.')
  return false
}

// ── Backend launcher ───────────────────────────────────────────────────────────

async function startBackend() {
  const binaryPath = getBackendBinaryPath()

  if (IS_DEV) {
    // Development: run via uvicorn inside the venv
    const projectRoot = path.join(__dirname, '..')
    const venvPython = IS_WIN
      ? path.join(projectRoot, 'backend', 'venv', 'Scripts', 'python.exe')
      : path.join(projectRoot, 'backend', 'venv', 'bin', 'python3')

    const backendScript = path.join(projectRoot, 'backend', 'main.py')

    console.log('[Backend] Starting in dev mode via uvicorn...')
    backendProcess = spawn(venvPython, [
      '-m', 'uvicorn', 'main:app',
      '--host', '127.0.0.1',
      '--port', String(BACKEND_PORT),
      '--log-level', 'warning'
    ], {
      cwd: path.join(projectRoot, 'backend'),
      env: {
        ...process.env,
        LEGALBOX_DATA_DIR: getDataPath(),
        OLLAMA_URL: activeOllamaUrl,
      }
    })
  } else {
    // Production: run compiled binary
    if (!fs.existsSync(binaryPath)) {
      throw new Error(`Backend binary not found at: ${binaryPath}`)
    }

    console.log('[Backend] Starting production binary...')
    backendProcess = spawn(binaryPath, [], {
      env: {
        ...process.env,
        LEGALBOX_DATA_DIR: getDataPath(),
        LEGALBOX_PORT: String(BACKEND_PORT),
        OLLAMA_URL: activeOllamaUrl,
      }
    })
  }

  backendProcess.stdout?.on('data', d => console.log('[Backend]', d.toString().trim()))
  backendProcess.stderr?.on('data', d => console.error('[Backend]', d.toString().trim()))
  backendProcess.on('exit', (code) => {
    console.log(`[Backend] Exited with code ${code}`)
  })
}

// ── Wait for backend to be ready ──────────────────────────────────────────────

function waitForBackend(maxAttempts = 30, intervalMs = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0

    const check = () => {
      attempts++
      const req = http.get(`${BACKEND_URL}/api/health`, (res) => {
        if (res.statusCode === 200) {
          console.log('[Backend] Ready!')
          resolve()
        } else {
          retry()
        }
      })
      req.on('error', () => retry())
      req.setTimeout(800, () => { req.destroy(); retry() })
    }

    const retry = () => {
      if (attempts >= maxAttempts) {
        reject(new Error('Backend did not start in time. Check that Ollama is installed.'))
        return
      }
      setTimeout(check, intervalMs)
    }

    check()
  })
}

// ── Create main window ─────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'OTG Legal Box',
    // App icon (set during build by electron-builder)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // On Mac, use native title bar with traffic lights
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    backgroundColor: '#f9fafb',
  })

  if (IS_DEV) {
    // Dev: load from Vite dev server
    mainWindow.loadURL(`http://localhost:${FRONTEND_PORT}`)
    mainWindow.webContents.openDevTools()
  } else {
    // Production: load built static files
    const frontendPath = getFrontendPath()
    mainWindow.loadFile(path.join(frontendPath, 'index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in the system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── Loading window (shown while backend starts) ───────────────────────────────

function createLoadingWindow() {
  const loading = new BrowserWindow({
    width: 420,
    height: 280,
    resizable: false,
    frame: false,
    backgroundColor: '#0f1f3d',
    webPreferences: { contextIsolation: true },
  })

  // Simple inline HTML for the loading screen
  loading.loadURL(`data:text/html,
    <html>
    <body style="margin:0;background:#0f1f3d;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;font-family:system-ui,sans-serif;">
      <div style="width:48px;height:48px;border-radius:12px;background:#c9a84c;display:flex;align-items:center;justify-content:center;margin-bottom:20px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      </div>
      <div style="color:white;font-size:18px;font-weight:600;margin-bottom:8px;">OTG Legal Box</div>
      <div style="color:rgba(255,255,255,0.5);font-size:13px;margin-bottom:24px;">Starting up…</div>
      <div style="width:200px;height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
        <div id="bar" style="height:100%;background:#c9a84c;border-radius:2px;width:0%;transition:width 0.3s;animation:load 2s ease-in-out infinite;"></div>
      </div>
      <style>
        @keyframes load {
          0%   { width: 0%; margin-left: 0%; }
          50%  { width: 60%; margin-left: 20%; }
          100% { width: 0%; margin-left: 100%; }
        }
      </style>
    </body>
    </html>
  `)

  return loading
}

// ── IPC handlers (frontend can call these) ────────────────────────────────────

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-data-path',   () => getDataPath())
ipcMain.handle('open-data-folder', () => shell.openPath(getDataPath()))
ipcMain.handle('open-external', (_, url) => shell.openExternal(url))

// ── App lifecycle ──────────────────────────────────────────────────────────────

async function startBackendWithRetry(loadingWindow) {
  // Keep prompting the user until the backend comes up or they quit.
  // The usual failure cause is Ollama not running — give them a clear path
  // to install it, come back, and retry.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      // If a previous attempt left a process around, kill it before retrying.
      if (backendProcess && !backendProcess.killed) {
        try { backendProcess.kill('SIGTERM') } catch {}
        backendProcess = null
      }
      await startBackend()
      await waitForBackend()
      return true
    } catch (err) {
      const choice = dialog.showMessageBoxSync({
        type: 'error',
        title: 'OTG Legal Box — Ollama not detected',
        message: 'OTG Legal Box could not start the AI engine.',
        detail:
          `${err.message}\n\n` +
          'OTG Legal Box needs Ollama to run the AI model on this computer. ' +
          'Ollama is a free, separate install — open the download page, install it, ' +
          'then click Retry here.\n\n' +
          'See INSTALL.md for the full walkthrough.',
        buttons: ['Download Ollama', 'Retry', 'Quit'],
        defaultId: 1,
        cancelId: 2,
      })
      if (choice === 0) {
        shell.openExternal('https://ollama.com/download')
        // Loop back and show the dialog again so the user can click Retry
        // once Ollama is installed.
      } else if (choice === 1) {
        // Retry: fall through to the next loop iteration
      } else {
        // Quit
        if (loadingWindow && !loadingWindow.isDestroyed()) loadingWindow.close()
        app.quit()
        return false
      }
    }
  }
}

// ── Renderer egress block ────────────────────────────────────────────────────
// Belt-and-braces with the backend egress guard: the UI is only ever allowed
// to talk to the local backend (and, in dev, the Vite server). Any other
// network request from the renderer — a stray CDN font, an analytics beacon,
// anything — is cancelled. This is what makes "nothing leaves the machine"
// demonstrable in the browser layer too.
function installRendererEgressBlock() {
  const allowedHosts = new Set(['127.0.0.1', 'localhost'])
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    const url = details.url
    if (
      url.startsWith('file:') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('devtools:')
    ) {
      return callback({ cancel: false })
    }
    try {
      const host = new URL(url).hostname
      return callback({ cancel: !allowedHosts.has(host) })
    } catch {
      return callback({ cancel: true })
    }
  })
}

app.whenReady().then(async () => {
  installRendererEgressBlock()

  // Ensure user data directory exists
  const dataPath = getDataPath()
  fs.mkdirSync(path.join(dataPath, 'cases'),   { recursive: true })
  fs.mkdirSync(path.join(dataPath, 'uploads'), { recursive: true })

  // Show loading screen while backend starts
  const loadingWindow = createLoadingWindow()

  // Bring up the AI runtime first (system Ollama if present, else the
  // bundled one) so the backend connects on its first try.
  await ensureOllama()

  const ok = await startBackendWithRetry(loadingWindow)
  if (!ok) return

  // Backend is up — close loading screen, open main window
  if (!loadingWindow.isDestroyed()) loadingWindow.close()
  createWindow()

  app.on('activate', () => {
    // On Mac, re-create window when clicking dock icon with no windows open
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // On Mac, apps typically stay open until explicitly quit
  if (!IS_MAC) {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Kill the backend process cleanly on quit
  if (backendProcess && !backendProcess.killed) {
    console.log('[Backend] Shutting down...')
    backendProcess.kill('SIGTERM')
  }
  // Kill the bundled Ollama runtime too (never a user's own system Ollama —
  // that one was detected on :11434 and left untouched)
  if (ollamaProcess && !ollamaProcess.killed) {
    console.log('[Ollama] Shutting down bundled runtime...')
    ollamaProcess.kill('SIGTERM')
  }
})

// Handle uncaught errors gracefully
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err)
})
