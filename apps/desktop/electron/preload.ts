import { contextBridge, ipcRenderer } from 'electron'
import { ENTERPRISE_AUTH_CALLBACK_CHANNEL } from './authCallback.js'

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
    writeFile: (filePath: string, bytes: Uint8Array | ArrayBuffer) =>
      ipcRenderer.invoke('muon:fs:write-file', filePath, bytes),
  },
  isElectron: true,
  mail: {
    send: (account: unknown, message: unknown) => ipcRenderer.invoke('muon:mail:send', account, message),
    fetchInbox: (account: unknown, limit?: number) => ipcRenderer.invoke('muon:mail:fetch-inbox', account, limit),
  },
  runtime: 'electron',
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
  theme: {
    set: (mode: 'light' | 'dark' | 'system') => ipcRenderer.invoke('muon:theme:set', mode),
    getAccent: () => ipcRenderer.invoke('muon:theme:get-accent'),
    onAccentChanged: (callback: (hex: string | null) => void) =>
      subscribeValue<string | null>('muon:theme:accent-changed', callback),
  },
  updater: {
    check: () => ipcRenderer.invoke('muon:updater:check'),
    install: () => ipcRenderer.invoke('muon:updater:install'),
  },
  window: {
    hide: () => ipcRenderer.invoke('muon:window:hide'),
    setFocus: () => ipcRenderer.invoke('muon:window:focus'),
    show: () => ipcRenderer.invoke('muon:window:show'),
  },
})
