import type { VueWrapper } from '@vue/test-utils'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConfirmDialogHost from '@/shared/components/ConfirmDialogHost.vue'
import { requestConfirmDialog } from '@/shared/services/confirmDialog'

describe('confirmDialogHost', () => {
  let wrapper: VueWrapper | null = null

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  it('renders a component confirmation and resolves true from the confirm action', async () => {
    wrapper = mount(ConfirmDialogHost, {
      attachTo: document.body,
    })

    const result = requestConfirmDialog('Delete this channel?', {
      cancelLabel: 'Cancel',
      kind: 'warning',
      okLabel: 'Delete',
      title: 'Delete channel',
    })

    await flushPromises()

    expect(document.body.textContent).toContain('Delete channel')
    expect(document.body.textContent).toContain('Delete this channel?')

    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find(button => button.textContent?.trim() === 'Delete')?.click()
    await flushPromises()

    await expect(result).resolves.toBe(true)
  })

  it('resolves false from the cancel action', async () => {
    wrapper = mount(ConfirmDialogHost, {
      attachTo: document.body,
    })

    const result = requestConfirmDialog('Leave this server?', {
      cancelLabel: 'Stay',
      kind: 'warning',
      okLabel: 'Leave',
      title: 'Leave server',
    })

    await flushPromises()

    const buttons = Array.from(document.body.querySelectorAll('button'))
    buttons.find(button => button.textContent?.trim() === 'Stay')?.click()
    await flushPromises()

    await expect(result).resolves.toBe(false)
  })
})
