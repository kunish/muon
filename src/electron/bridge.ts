export interface DesktopFileFilter {
  name: string
  extensions: string[]
}

export interface DesktopDialogOpenOptions {
  multiple?: boolean
  filters?: DesktopFileFilter[]
}

export interface DesktopDialogSaveOptions {
  defaultPath?: string
  filters?: DesktopFileFilter[]
}

export interface DesktopDialogAskOptions {
  title?: string
  detail?: string
  kind?: 'info' | 'warning' | 'error'
  okLabel?: string
  cancelLabel?: string
}

export interface DesktopPosition {
  x: number
  y: number
}

export interface DesktopSize {
  height: number
  width: number
}

export interface DesktopMonitor {
  name: string
  position: DesktopPosition
  scaleFactor: number
  size: DesktopSize
  workArea: {
    position: DesktopPosition
    size: DesktopSize
  }
}

export type UnlistenFn = () => void

export interface SerializedFetchBody {
  kind: 'bytes' | 'text'
  value: ArrayBuffer | string
}

export interface SerializedFetchRequest {
  url: string
  init?: {
    body?: SerializedFetchBody
    headers?: Array<[string, string]>
    method?: string
    redirect?: RequestRedirect
  }
}

export interface SerializedFetchResponse {
  body: ArrayBuffer
  headers: Array<[string, string]>
  status: number
  statusText: string
  url: string
}

export interface MuonDesktopBridge {
  isElectron: true
  platform: string
  dialog: {
    ask: (message: string, options?: DesktopDialogAskOptions) => Promise<boolean>
    open: (options?: DesktopDialogOpenOptions) => Promise<string | string[] | null>
    save: (options?: DesktopDialogSaveOptions) => Promise<string | null>
  }
  fetch: (request: SerializedFetchRequest) => Promise<SerializedFetchResponse>
  fs: {
    readFile: (path: string) => Promise<ArrayBuffer>
    writeFile: (path: string, bytes: Uint8Array | ArrayBuffer) => Promise<void>
  }
  shell: {
    openPath: (path: string) => Promise<string>
    openUrl: (url: string) => Promise<void>
    revealItemInDir: (path: string) => Promise<void>
  }
  updater: {
    check: () => Promise<{ version: string } | null>
    install: () => Promise<void>
  }
  window: {
    close: () => Promise<void>
    currentMonitor: () => Promise<DesktopMonitor | null>
    hide: () => Promise<void>
    isFocused: () => Promise<boolean>
    isMaximized: () => Promise<boolean>
    maximize: () => Promise<void>
    minimize: () => Promise<void>
    onBlurred: (callback: () => void) => UnlistenFn
    onFocused: (callback: () => void) => UnlistenFn
    onMoved: (callback: () => void) => UnlistenFn
    onResized: (callback: () => void) => UnlistenFn
    outerPosition: () => Promise<DesktopPosition>
    outerSize: () => Promise<DesktopSize>
    setFocus: () => Promise<void>
    setPosition: (position: DesktopPosition) => Promise<void>
    setSize: (size: DesktopSize) => Promise<void>
    show: () => Promise<void>
    unmaximize: () => Promise<void>
  }
}

declare global {
  interface Window {
    muonDesktop?: MuonDesktopBridge
  }
}

export function getDesktopBridge(): MuonDesktopBridge | undefined {
  if (typeof window === 'undefined')
    return undefined

  return window.muonDesktop
}

export function isElectronRuntime(): boolean {
  return getDesktopBridge()?.isElectron === true
}
