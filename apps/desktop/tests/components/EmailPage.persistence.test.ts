import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import EmailPage from '@/features/email/components/EmailPage.vue'

describe('email persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('keeps a starred message starred across remounts', async () => {
    const first = mount(EmailPage)
    await first.get('[data-testid="email-message-mail-1"]').trigger('click')
    await first.get('[data-testid="email-star-selected"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('muon_email_overrides') || '{}')
    expect(stored['mail-1']).toMatchObject({ starred: true, read: true })

    const second = mount(EmailPage)
    await second.get('[data-testid="email-folder-starred"]').trigger('click')

    expect(second.get('[data-testid="email-folder-count-starred"]').text()).toBe('2')
    expect(second.find('[data-testid="email-message-mail-1"]').exists()).toBe(true)
  })

  it('keeps a read message read across remounts', async () => {
    const first = mount(EmailPage)
    expect(first.get('[data-testid="email-message-mail-1"]').find('.size-2.bg-primary').exists()).toBe(true)
    await first.get('[data-testid="email-message-mail-1"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('muon_email_overrides') || '{}')
    expect(stored['mail-1']).toMatchObject({ read: true })

    const second = mount(EmailPage)
    expect(second.get('[data-testid="email-message-mail-1"]').find('.size-2.bg-primary').exists()).toBe(false)
  })

  it('moves a message to trash and keeps it there across remounts', async () => {
    const first = mount(EmailPage)
    await first.get('[data-testid="email-message-mail-1"]').trigger('click')
    await first.get('[data-testid="email-delete-selected"]').trigger('click')

    const stored = JSON.parse(localStorage.getItem('muon_email_overrides') || '{}')
    expect(stored['mail-1']).toMatchObject({ trashed: true })

    const second = mount(EmailPage)
    await second.get('[data-testid="email-folder-trash"]').trigger('click')
    expect(second.find('[data-testid="email-message-mail-1"]').exists()).toBe(true)
    // 已移入废件箱后不再出现在收件箱
    await second.get('[data-testid="email-folder-inbox"]').trigger('click')
    expect(second.find('[data-testid="email-message-mail-1"]').exists()).toBe(false)
  })
})
