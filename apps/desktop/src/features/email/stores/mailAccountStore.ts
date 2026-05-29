import type { MailAccountConfig } from '@/desktop/mail'
import type { SafeStorageLike } from '@/shared/safeStorageStore'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
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

/** 邮箱账号(SMTP/IMAP)凭据;密码经 safeStorage 加密落盘 */
export const useMailAccountStore = defineStore('mailAccount', () => {
  const account = ref<MailAccountConfig | null>(null)
  const loaded = ref(false)
  const store = makeEncryptedStore({ key: STORAGE_KEY, schema: mailAccountSchema, safeStorage: bridgeSafeStorage() })

  const isConfigured = computed(() => account.value !== null)

  async function load(): Promise<void> {
    account.value = await store.read()
    loaded.value = true
  }

  async function save(config: MailAccountConfig): Promise<void> {
    account.value = config
    await store.write(config)
  }

  function clear(): void {
    account.value = null
    store.clear()
  }

  return { account, loaded, isConfigured, load, save, clear }
})
