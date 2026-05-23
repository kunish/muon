import { Buffer } from 'node:buffer'
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import process from 'node:process'
import { app, BrowserWindow, dialog, ipcMain, net, safeStorage, shell } from 'electron'
import {
  ENTERPRISE_AUTH_CALLBACK_CHANNEL,
  extractEnterpriseAuthCallbackUrl,
  isEnterpriseAuthCallbackUrl,
} from './authCallback.js'

let mainWindow: BrowserWindow | null = null
const runtimeRequire = createRequire(__filename)
let pendingAuthCallbackUrl: string | null = null
let closeToTrayEnabled = false
let isQuitting = false

function getMainWindow(): BrowserWindow {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('Main window is not available')

  return mainWindow
}

function getRendererEntry(): string {
  return join(__dirname, '..', 'renderer', 'index.html')
}

function getPreloadEntry(): string {
  return join(__dirname, '..', 'preload', 'preload.cjs')
}

function getWorkspaceRoot(): string {
  return join(__dirname, '..', '..', '..', '..')
}

function getDevelopmentAppIconPath(): string {
  const iconRoot = join(getWorkspaceRoot(), 'build', 'icons')
  if (process.platform === 'win32') return join(iconRoot, 'icon.ico')

  return join(iconRoot, 'png-set', 'icon.png')
}

function getRuntimeAppIconPath(): string | undefined {
  if (app.isPackaged) return undefined

  const appIconPath = getDevelopmentAppIconPath()
  return existsSync(appIconPath) ? appIconPath : undefined
}

function applyRuntimeAppIcon(): void {
  const appIconPath = getRuntimeAppIconPath()
  if (process.platform === 'darwin' && appIconPath && app.dock) app.dock.setIcon(appIconPath)
}

function sendEnterpriseAuthCallbackUrl(url: string): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingAuthCallbackUrl = url
    return
  }

  mainWindow.webContents.send(ENTERPRISE_AUTH_CALLBACK_CHANNEL, url)
}

function registerEnterpriseProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('muon', process.execPath, [process.argv[1]])
    return
  }

  app.setAsDefaultProtocolClient('muon')
}

function normalizeFilters(filters: unknown): Electron.FileFilter[] | undefined {
  if (!Array.isArray(filters)) return undefined

  return filters.map((filter) => {
    const item = filter as { extensions?: unknown; name?: unknown }
    return {
      extensions: Array.isArray(item.extensions) ? item.extensions.map(String) : [],
      name: String(item.name || 'Files'),
    }
  })
}

function normalizeMessageBoxKind(kind: unknown): Electron.MessageBoxOptions['type'] {
  if (kind === 'error') return 'error'
  if (kind === 'warning') return 'warning'
  if (kind === 'info') return 'info'
  return 'question'
}

function serializeHeaders(headers: Headers): Array<[string, string]> {
  const result: Array<[string, string]> = []
  headers.forEach((value, key) => {
    result.push([key, value])
  })
  return result
}

function serializeRecordHeaders(headers: Record<string, string | string[]>): Array<[string, string]> {
  return Object.entries(headers).flatMap(([key, value]) =>
    Array.isArray(value) ? value.map((item) => [key, item] as [string, string]) : [[key, value]],
  )
}

function requestHeadersToRecord(headers: Array<[string, string]> | undefined): Record<string, string> | undefined {
  if (!headers) return undefined

  const result: Record<string, string> = {}
  for (const [key, value] of headers) result[key] = value
  return result
}

function bufferToArrayBuffer(buffer: Buffer): ArrayBuffer {
  const bytes = new Uint8Array(buffer.byteLength)
  bytes.set(buffer)
  return bytes.buffer
}

function deserializeBody(body: { kind?: string; value?: unknown } | undefined): BodyInit | undefined {
  if (!body) return undefined

  if (body.kind === 'bytes' && body.value instanceof ArrayBuffer) return Buffer.from(body.value)

  return typeof body.value === 'string' ? body.value : undefined
}

function normalizeFetchInit(
  init: {
    body?: { kind?: string; value?: unknown }
    headers?: Array<[string, string]>
    method?: string
    redirect?: RequestRedirect
  } = {},
): RequestInit {
  const body = deserializeBody(init.body)
  const normalized: RequestInit = {
    headers: init.headers,
    method: init.method,
    redirect: init.redirect,
  }

  if (body !== undefined) normalized.body = body

  return normalized
}

interface MainFetchRequest {
  init?: {
    body?: { kind?: string; value?: unknown }
    headers?: Array<[string, string]>
    method?: string
    redirect?: RequestRedirect
  }
  url: string
}

interface MainFetchResponse {
  body: ArrayBuffer
  headers: Array<[string, string]>
  status: number
  statusText: string
  url: string
}

async function fetchNetResponse(fetchRequest: MainFetchRequest): Promise<MainFetchResponse> {
  const response = await net.fetch(fetchRequest.url, normalizeFetchInit(fetchRequest.init))
  const body = await response.arrayBuffer()

  return {
    body,
    headers: serializeHeaders(response.headers),
    status: response.status,
    statusText: response.statusText,
    url: response.url,
  }
}

function fetchManualRedirectResponse(fetchRequest: MainFetchRequest): Promise<MainFetchResponse> {
  return new Promise((resolve, reject) => {
    const init = fetchRequest.init ?? {}
    const manualRequest = net.request({
      headers: requestHeadersToRecord(init.headers),
      method: init.method,
      redirect: 'manual',
      url: fetchRequest.url,
    })
    let settled = false

    function settle(fn: () => void): void {
      if (settled) return
      settled = true
      fn()
    }

    manualRequest.on('redirect', (statusCode, _method, redirectUrl, responseHeaders) => {
      const headers = serializeRecordHeaders({
        ...responseHeaders,
        location: responseHeaders.location ?? [redirectUrl],
      })
      settle(() =>
        resolve({
          body: new ArrayBuffer(0),
          headers,
          status: statusCode,
          statusText: '',
          url: fetchRequest.url,
        }),
      )
    })

    manualRequest.on('response', (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => {
        const body = bufferToArrayBuffer(Buffer.concat(chunks))
        settle(() =>
          resolve({
            body,
            headers: serializeRecordHeaders(response.headers),
            status: response.statusCode,
            statusText: response.statusMessage,
            url: fetchRequest.url,
          }),
        )
      })
      response.on('error', (error) => settle(() => reject(error)))
    })

    manualRequest.on('error', (error) => settle(() => reject(error)))

    const body = deserializeBody(init.body)
    if (Buffer.isBuffer(body) || typeof body === 'string') manualRequest.write(body)
    manualRequest.end()
  })
}

function registerWindowIpc(): void {
  ipcMain.handle('muon:window:hide', () => getMainWindow().hide())
  ipcMain.handle('muon:window:show', () => getMainWindow().show())
  ipcMain.handle('muon:window:focus', () => getMainWindow().focus())
}

function registerDialogIpc(): void {
  ipcMain.handle('muon:dialog:open', async (_event, options: { filters?: unknown; multiple?: boolean } = {}) => {
    const result = await dialog.showOpenDialog(getMainWindow(), {
      filters: normalizeFilters(options.filters),
      properties: options.multiple ? ['openFile', 'multiSelections'] : ['openFile'],
    })

    if (result.canceled || result.filePaths.length === 0) return null

    return options.multiple ? result.filePaths : result.filePaths[0]
  })

  ipcMain.handle('muon:dialog:save', async (_event, options: { defaultPath?: string; filters?: unknown } = {}) => {
    const result = await dialog.showSaveDialog(getMainWindow(), {
      defaultPath: options.defaultPath,
      filters: normalizeFilters(options.filters),
    })

    return result.canceled ? null : result.filePath || null
  })

  ipcMain.handle(
    'muon:dialog:ask',
    async (
      _event,
      message: string,
      options: {
        cancelLabel?: string
        detail?: string
        kind?: string
        okLabel?: string
        title?: string
      } = {},
    ) => {
      const result = await dialog.showMessageBox(getMainWindow(), {
        buttons: [options.okLabel || 'OK', options.cancelLabel || 'Cancel'],
        cancelId: 1,
        defaultId: 0,
        detail: options.detail,
        message: String(message),
        noLink: true,
        title: options.title,
        type: normalizeMessageBoxKind(options.kind),
      })

      return result.response === 0
    },
  )
}

function validateFilePath(filePath: string): void {
  if (!filePath || typeof filePath !== 'string') throw new Error('Invalid file path')

  const resolved = join(filePath)
  if (resolved.includes('..')) throw new Error('Path traversal is not allowed')
}

function registerFileIpc(): void {
  ipcMain.handle('muon:fs:read-file', async (_event, filePath: string) => {
    validateFilePath(filePath)
    const data = await readFile(filePath)
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
  })

  ipcMain.handle('muon:fs:write-file', async (_event, filePath: string, bytes: Uint8Array | ArrayBuffer) => {
    validateFilePath(filePath)
    const buffer = bytes instanceof ArrayBuffer ? Buffer.from(new Uint8Array(bytes)) : Buffer.from(bytes)
    await writeFile(filePath, buffer)
  })
}

function isValidExternalUrl(value: string): boolean {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:'
  } catch {
    return false
  }
}

function registerShellIpc(): void {
  ipcMain.handle('muon:shell:open-path', (_event, targetPath: string) => shell.openPath(targetPath))
  ipcMain.handle('muon:shell:reveal-item-in-dir', (_event, targetPath: string) => shell.showItemInFolder(targetPath))
  ipcMain.handle('muon:shell:open-url', (_event, url: string) => {
    if (!isValidExternalUrl(url)) throw new Error(`Blocked opening URL with disallowed protocol: ${url.slice(0, 50)}`)
    return shell.openExternal(url)
  })
}

function registerFetchIpc(): void {
  ipcMain.handle('muon:fetch', async (_event, request: MainFetchRequest) => {
    if (request.init?.redirect === 'manual') return await fetchManualRedirectResponse(request)

    return await fetchNetResponse(request)
  })
}

function registerAppSettingsIpc(): void {
  ipcMain.handle('muon:app:set-auto-launch', (_event, enabled: boolean) => {
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) })
  })

  ipcMain.handle('muon:app:set-close-to-tray', (_event, enabled: boolean) => {
    closeToTrayEnabled = Boolean(enabled)
  })
}

function getAutoUpdater(): typeof import('electron-updater').autoUpdater {
  return runtimeRequire('electron-updater').autoUpdater
}

function registerUpdaterIpc(): void {
  // NOTE: For production releases, configure code signing certificates in the
  // electron-builder "build" config (package.json) to enable update signature
  // verification. Without signing, auto-updates cannot be cryptographically verified.
  // See: https://www.electron.build/code-signing
  ipcMain.handle('muon:updater:check', async () => {
    if (!app.isPackaged) return null

    const autoUpdater = getAutoUpdater()
    autoUpdater.autoDownload = false
    const result = await autoUpdater.checkForUpdates()
    const version = result?.updateInfo?.version
    return version ? { version } : null
  })

  ipcMain.handle('muon:updater:install', async () => {
    const autoUpdater = getAutoUpdater()
    await autoUpdater.downloadUpdate()
    autoUpdater.quitAndInstall()
  })
}

function registerSafeStorageIpc(): void {
  ipcMain.handle('muon:safe-storage:is-available', () => safeStorage.isEncryptionAvailable())

  ipcMain.handle('muon:safe-storage:encrypt', (_event, plaintext: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage encryption is not available on this platform')
    }
    return safeStorage.encryptString(plaintext).toString('base64')
  })

  ipcMain.handle('muon:safe-storage:decrypt', (_event, base64: string) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('safeStorage encryption is not available on this platform')
    }
    return safeStorage.decryptString(Buffer.from(base64, 'base64'))
  })
}

function registerIpc(): void {
  registerWindowIpc()
  registerDialogIpc()
  registerFileIpc()
  registerShellIpc()
  registerFetchIpc()
  registerAppSettingsIpc()
  registerUpdaterIpc()
  registerSafeStorageIpc()
}

function createMainWindow(): void {
  const appIconPath = getRuntimeAppIconPath()

  mainWindow = new BrowserWindow({
    ...(appIconPath ? { icon: appIconPath } : {}),
    backgroundColor: '#ffffff',
    frame: true,
    height: 768,
    minHeight: 600,
    minWidth: 800,
    resizable: true,
    show: false,
    title: 'Muon',
    titleBarOverlay: {
      color: '#00000000',
      height: 36,
    },
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 12 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadEntry(),
      sandbox: true,
      webSecurity: true,
    },
    width: 1024,
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (app.isPackaged && mainWindow) {
      mainWindow.webContents.closeDevTools()
      mainWindow.webContents.on('devtools-opened', () => {
        mainWindow?.webContents.closeDevTools()
      })
    }
    if (pendingAuthCallbackUrl) {
      sendEnterpriseAuthCallbackUrl(pendingAuthCallbackUrl)
      pendingAuthCallbackUrl = null
    }
  })

  mainWindow.on('close', (event) => {
    if (!closeToTrayEnabled || isQuitting) return

    event.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Defense-in-depth CSP: ensure script-src and object-src cannot be relaxed
  // even if the HTML meta tag is somehow removed or bypassed.
  if (app.isPackaged) {
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'content-security-policy': [
            "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https:; font-src 'self' data:; media-src 'self' blob: data: https:; connect-src 'self' http: https: ws: wss:; worker-src 'self' blob:; frame-src 'none'",
          ],
        },
      })
    })
  }

  if (!app.isPackaged && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(getRendererEntry())
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    if (!mainWindow) return

    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()

    const authCallbackUrl = extractEnterpriseAuthCallbackUrl(argv)
    if (authCallbackUrl) sendEnterpriseAuthCallbackUrl(authCallbackUrl)
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (isEnterpriseAuthCallbackUrl(url)) sendEnterpriseAuthCallbackUrl(url)
  })

  app.on('before-quit', () => {
    isQuitting = true
  })

  app.whenReady().then(() => {
    registerEnterpriseProtocol()
    registerIpc()
    applyRuntimeAppIcon()
    createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
