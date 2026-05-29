import type { MailAccountConfig } from '@/desktop/mail'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useMailAccountStore } from '@/features/email/stores/mailAccountStore'

const account: MailAccountConfig = {
  user: 'me@example.com',
  password: 'secret',
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpSecure: true,
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapSecure: true,
}

describe('mail account store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts unconfigured', () => {
    expect(useMailAccountStore().isConfigured).toBe(false)
  })

  it('persists the account and reloads it on a fresh store', async () => {
    await useMailAccountStore().save(account)

    setActivePinia(createPinia())
    const reloaded = useMailAccountStore()
    await reloaded.load()

    expect(reloaded.isConfigured).toBe(true)
    expect(reloaded.account).toEqual(account)
  })

  it('clears the stored account', async () => {
    const store = useMailAccountStore()
    await store.save(account)
    store.clear()
    expect(store.account).toBeNull()

    setActivePinia(createPinia())
    const reloaded = useMailAccountStore()
    await reloaded.load()
    expect(reloaded.account).toBeNull()
  })
})
