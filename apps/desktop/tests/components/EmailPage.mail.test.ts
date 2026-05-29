import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmailPage from '@/features/email/components/EmailPage.vue'

const account = {
  user: 'me@example.com',
  password: 'secret',
  smtpHost: 'smtp.example.com',
  smtpPort: 465,
  smtpSecure: true,
  imapHost: 'imap.example.com',
  imapPort: 993,
  imapSecure: true,
}

const sendMail = vi.hoisted(() => vi.fn().mockResolvedValue({ messageId: '<1@example.com>' }))
const fetchInbox = vi.hoisted(() => vi.fn())

vi.mock('@/desktop/mail', () => ({
  isMailBridgeAvailable: () => true,
  sendMail,
  fetchInbox,
}))

vi.mock('@/features/email/stores/mailAccountStore', () => ({
  useMailAccountStore: () => ({
    account,
    isConfigured: true,
    loaded: true,
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  }),
}))

describe('email real send/receive', () => {
  beforeEach(() => {
    localStorage.clear()
    sendMail.mockClear()
    fetchInbox.mockClear()
    fetchInbox.mockResolvedValue([])
  })

  it('sends a real email through the configured account', async () => {
    const wrapper = mount(EmailPage)

    await wrapper.get('[data-testid="email-compose"]').trigger('click')
    await wrapper.get('[data-testid="email-compose-to"]').setValue('ops@example.com')
    await wrapper.get('[data-testid="email-compose-subject"]').setValue('Deploy check')
    await wrapper.get('[data-testid="email-compose-body"]').setValue('Confirm tonight window.')
    await wrapper.get('[data-testid="email-compose-send"]').trigger('click')
    await flushPromises()

    expect(sendMail).toHaveBeenCalledWith(account, {
      to: 'ops@example.com',
      subject: 'Deploy check',
      text: 'Confirm tonight window.',
    })
  })

  it('fetches the real inbox and lists the messages', async () => {
    fetchInbox.mockResolvedValueOnce([
      {
        uid: '42',
        from: 'alice@example.com',
        fromName: 'Alice',
        subject: 'Quarterly report',
        date: '2026-05-30T10:00:00.000Z',
        snippet: 'Please review the attached report.',
        seen: false,
      },
    ])

    const wrapper = mount(EmailPage)
    await wrapper.get('[data-testid="email-refresh"]').trigger('click')
    await flushPromises()

    expect(fetchInbox).toHaveBeenCalledWith(account, 30)
    expect(wrapper.text()).toContain('Quarterly report')
    expect(wrapper.text()).toContain('Alice')
  })
})
