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

export type DesktopRuntime = 'electron' | 'electrobun'

export interface MailAccountConfig {
  user: string
  password: string
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  imapHost: string
  imapPort: number
  imapSecure: boolean
}

export interface OutgoingMailMessage {
  to: string
  subject: string
  text: string
  from?: string
}

export interface FetchedMail {
  uid: string
  from: string
  fromName: string
  subject: string
  date: string
  snippet: string
  seen: boolean
}

export interface MuonDesktopBridge {
  isElectron: true
  runtime: DesktopRuntime
  platform?: string
  app: {
    setAutoLaunch: (enabled: boolean) => Promise<void>
    setCloseToTray: (enabled: boolean) => Promise<void>
  }
  auth: {
    onCallback: (callback: (url: string) => void) => UnlistenFn
  }
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
  mail?: {
    send: (account: MailAccountConfig, message: OutgoingMailMessage) => Promise<{ messageId: string }>
    fetchInbox: (account: MailAccountConfig, limit?: number) => Promise<FetchedMail[]>
  }
  safeStorage: {
    isAvailable: () => Promise<boolean>
    encrypt: (plaintext: string) => Promise<string>
    decrypt: (base64: string) => Promise<string>
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
    hide: () => Promise<void>
    setFocus: () => Promise<void>
    show: () => Promise<void>
  }
}

declare global {
  interface Window {
    muonDesktop?: MuonDesktopBridge
  }
}

export function getDesktopBridge(): MuonDesktopBridge | undefined {
  if (typeof window === 'undefined') return undefined

  return window.muonDesktop
}

export function getDesktopRuntime(): DesktopRuntime | undefined {
  return getDesktopBridge()?.runtime
}

export function isElectronRuntime(): boolean {
  return getDesktopBridge()?.isElectron === true
}

export function isElectrobunRuntime(): boolean {
  return getDesktopRuntime() === 'electrobun'
}
