// electron/preload.js — Secure bridge between Electron and the web page
//
// This file runs in a privileged context before the web page loads.
// It exposes ONLY the specific functions we want the web page to access.
// Everything else about the Node.js/Electron API remains hidden.

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('legalbox', {
  // Get the app version (shown in Settings page)
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  // Get the path where user data is stored (shown in Settings page)
  getDataPath: () => ipcRenderer.invoke('get-data-path'),

  // Open the data folder in Finder/Explorer (useful for backups)
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),

  // Open a URL in the system browser (used by onboarding wizard for Ollama download)
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
})
