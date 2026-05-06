import { contextBridge, ipcRenderer } from 'electron'
import { ENTERPRISE_AUTH_CALLBACK_CHANNEL } from './authCallback.js'

function subscribe(channel: string, callback: () => void): () => void {
  const listener = (): void => callback()
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

function subscribeValue<T>(channel: string, callback: (value: T) => void): () => void {
  const listener = (_event: Electron.IpcRendererEvent, value: T): void => callback(value)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('muonDesktop', {
  app: {
    setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('muon:app:set-auto-launch', enabled),
    setCloseToTray: (enabled: boolean) => ipcRenderer.invoke('muon:app:set-close-to-tray', enabled),
  },
  auth: {
    onCallback: (callback: (url: string) => void) => subscribeValue(ENTERPRISE_AUTH_CALLBACK_CHANNEL, callback),
  },
  dialog: {
    ask: (message: string, options?: unknown) => ipcRenderer.invoke('muon:dialog:ask', message, options),
    open: (options?: unknown) => ipcRenderer.invoke('muon:dialog:open', options),
    save: (options?: unknown) => ipcRenderer.invoke('muon:dialog:save', options),
  },
  fetch: (request: unknown) => ipcRenderer.invoke('muon:fetch', request),
  fs: {
    readFile: (filePath: string) => ipcRenderer.invoke('muon:fs:read-file', filePath),
    writeFile: (filePath: string, bytes: Uint8Array | ArrayBuffer) => ipcRenderer.invoke('muon:fs:write-file', filePath, bytes),
  },
  isElectron: true,
  // eslint-disable-next-line node/prefer-global/process -- Electron sandbox preloads may not expose process at all.
  platform: globalThis.process?.platform,
  safeStorage: {
    isAvailable: () => ipcRenderer.invoke('muon:safe-storage:is-available'),
    encrypt: (plaintext: string) => ipcRenderer.invoke('muon:safe-storage:encrypt', plaintext),
    decrypt: (base64: string) => ipcRenderer.invoke('muon:safe-storage:decrypt', base64),
  },
  shell: {
    openPath: (targetPath: string) => ipcRenderer.invoke('muon:shell:open-path', targetPath),
    openUrl: (url: string) => ipcRenderer.invoke('muon:shell:open-url', url),
    revealItemInDir: (targetPath: string) => ipcRenderer.invoke('muon:shell:reveal-item-in-dir', targetPath),
  },
  updater: {
    check: () => ipcRenderer.invoke('muon:updater:check'),
    install: () => ipcRenderer.invoke('muon:updater:install'),
  },
  window: {
    close: () => ipcRenderer.invoke('muon:window:close'),
    currentMonitor: () => ipcRenderer.invoke('muon:window:current-monitor'),
    hide: () => ipcRenderer.invoke('muon:window:hide'),
    isFocused: () => ipcRenderer.invoke('muon:window:is-focused'),
    isMaximized: () => ipcRenderer.invoke('muon:window:is-maximized'),
    maximize: () => ipcRenderer.invoke('muon:window:maximize'),
    minimize: () => ipcRenderer.invoke('muon:window:minimize'),
    onBlurred: (callback: () => void) => subscribe('muon:window:blurred', callback),
    onFocused: (callback: () => void) => subscribe('muon:window:focused', callback),
    onMoved: (callback: () => void) => subscribe('muon:window:moved', callback),
    onResized: (callback: () => void) => subscribe('muon:window:resized', callback),
    outerPosition: () => ipcRenderer.invoke('muon:window:outer-position'),
    outerSize: () => ipcRenderer.invoke('muon:window:outer-size'),
    setFocus: () => ipcRenderer.invoke('muon:window:focus'),
    setPosition: (position: unknown) => ipcRenderer.invoke('muon:window:set-position', position),
    setSize: (size: unknown) => ipcRenderer.invoke('muon:window:set-size', size),
    show: () => ipcRenderer.invoke('muon:window:show'),
    unmaximize: () => ipcRenderer.invoke('muon:window:unmaximize'),
  },
})
