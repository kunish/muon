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
    buttons.find((button) => button.textContent?.trim() === 'Delete')?.click()
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
    buttons.find((button) => button.textContent?.trim() === 'Stay')?.click()
    await flushPromises()

    await expect(result).resolves.toBe(false)
  })

  it('queues confirmation requests and shows the next request after the active one settles', async () => {
    wrapper = mount(ConfirmDialogHost, {
      attachTo: document.body,
    })

    const first = requestConfirmDialog('Delete the first item?', {
      okLabel: 'Delete first',
      title: 'First request',
    })
    const second = requestConfirmDialog('Delete the second item?', {
      okLabel: 'Delete second',
      title: 'Second request',
    })

    await flushPromises()

    expect(document.body.textContent).toContain('First request')
    expect(document.body.textContent).not.toContain('Second request')

    Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete first')
      ?.click()
    await flushPromises()

    await expect(first).resolves.toBe(true)
    expect(document.body.textContent).toContain('Second request')

    Array.from(document.body.querySelectorAll('button'))
      .find((button) => button.textContent?.trim() === 'Delete second')
      ?.click()
    await flushPromises()

    await expect(second).resolves.toBe(true)
  })
})
