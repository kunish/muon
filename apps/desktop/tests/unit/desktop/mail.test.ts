import type { MailAccountConfig } from '@/desktop/mail'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchInbox, isMailBridgeAvailable, sendMail } from '@/desktop/mail'

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

afterEach(() => {
  delete (window as unknown as { muonDesktop?: unknown }).muonDesktop
})

function installBridge(mail: unknown): void {
  ;(window as unknown as { muonDesktop?: unknown }).muonDesktop = { mail }
}

describe('desktop mail bridge', () => {
  it('reports availability based on the bridge', () => {
    expect(isMailBridgeAvailable()).toBe(false)
    installBridge({})
    expect(isMailBridgeAvailable()).toBe(true)
  })

  it('forwards sendMail to the bridge', async () => {
    const send = vi.fn().mockResolvedValue({ messageId: '<1@example.com>' })
    installBridge({ send, fetchInbox: vi.fn() })

    const message = { to: 'a@b.com', subject: 'Hi', text: 'body' }
    await expect(sendMail(account, message)).resolves.toEqual({ messageId: '<1@example.com>' })
    expect(send).toHaveBeenCalledWith(account, message)
  })

  it('forwards fetchInbox to the bridge', async () => {
    const fetch = vi.fn().mockResolvedValue([])
    installBridge({ send: vi.fn(), fetchInbox: fetch })

    await fetchInbox(account, 10)
    expect(fetch).toHaveBeenCalledWith(account, 10)
  })

  it('throws when the mail bridge is unavailable', async () => {
    await expect(sendMail(account, { to: 'a@b.com', subject: 's', text: 't' })).rejects.toThrow(
      'mail bridge unavailable',
    )
  })
})
