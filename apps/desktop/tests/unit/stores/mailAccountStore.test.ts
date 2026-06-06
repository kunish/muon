import type { MailAccountConfig } from '@/desktop/mail'
import { beforeEach, describe, expect, it } from 'vitest'
import { clear, load, mailAccountStore, resetMailAccountStore, save } from '@/features/email/stores/mailAccountStore'

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
    localStorage.clear()
    resetMailAccountStore()
  })

  it('starts unconfigured', () => {
    expect(mailAccountStore.state.account).toBeNull()
  })

  it('persists the account and reloads it after the in-memory state is reset', async () => {
    await save(account)

    // Simulate a fresh app start: wipe in-memory state, keep encrypted storage.
    resetMailAccountStore()
    expect(mailAccountStore.state.account).toBeNull()

    await load()

    expect(mailAccountStore.state.account).toEqual(account)
    expect(mailAccountStore.state.loaded).toBe(true)
  })

  it('clears the stored account from both memory and storage', async () => {
    await save(account)

    clear()
    expect(mailAccountStore.state.account).toBeNull()

    resetMailAccountStore()
    await load()
    expect(mailAccountStore.state.account).toBeNull()
  })
})
