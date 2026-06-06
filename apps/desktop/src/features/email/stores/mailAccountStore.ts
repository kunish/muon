import type { MailAccountConfig } from '@/desktop/mail'
import type { SafeStorageLike } from '@/shared/safeStorageStore'
import { Store } from '@tanstack/vue-store'
import { z } from 'zod'
import { getDesktopBridge, isElectronRuntime } from '@/desktop/bridge'
import { makeEncryptedStore } from '@/shared/safeStorageStore'

const STORAGE_KEY = 'muon_mail_account'

const mailAccountSchema = z.object({
  user: z.string(),
  password: z.string(),
  smtpHost: z.string(),
  smtpPort: z.number(),
  smtpSecure: z.boolean(),
  imapHost: z.string(),
  imapPort: z.number(),
  imapSecure: z.boolean(),
})

function bridgeSafeStorage(): SafeStorageLike {
  if (!isElectronRuntime()) {
    return {
      isAvailable: () => Promise.resolve(false),
      encrypt: (value) => Promise.resolve(value),
      decrypt: (value) => Promise.resolve(value),
    }
  }
  return {
    isAvailable: () => getDesktopBridge()!.safeStorage.isAvailable(),
    encrypt: (value) => getDesktopBridge()!.safeStorage.encrypt(value),
    decrypt: (value) => getDesktopBridge()!.safeStorage.decrypt(value),
  }
}

const encryptedStore = makeEncryptedStore({
  key: STORAGE_KEY,
  schema: mailAccountSchema,
  safeStorage: bridgeSafeStorage(),
})

export interface MailAccountState {
  /** SMTP/IMAP credentials; the password is encrypted at rest via safeStorage. */
  account: MailAccountConfig | null
  loaded: boolean
}

function createInitialState(): MailAccountState {
  return { account: null, loaded: false }
}

export const mailAccountStore = new Store<MailAccountState>(createInitialState())

export async function load(): Promise<void> {
  const account = await encryptedStore.read()
  mailAccountStore.setState((prev) => ({ ...prev, account, loaded: true }))
}

export async function save(config: MailAccountConfig): Promise<void> {
  mailAccountStore.setState((prev) => ({ ...prev, account: config }))
  await encryptedStore.write(config)
}

export function clear(): void {
  mailAccountStore.setState((prev) => ({ ...prev, account: null }))
  encryptedStore.clear()
}

/** Reset only the in-memory state (encrypted storage is untouched) — for tests/lifecycle. */
export function resetMailAccountStore(): void {
  mailAccountStore.setState(() => createInitialState())
}
