import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ForwardDialog from '@/features/chat/components/ForwardDialog.vue'

const forwardMessagesSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const sendMessageSpy = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@matrix/messages', () => ({ forwardMessages: forwardMessagesSpy }))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRooms: () => [{ roomId: '!target:localhost', name: 'Target Room', getMyMembership: () => 'join' }],
    getUser: () => null,
    getUserId: () => '@me:localhost',
    sendMessage: sendMessageSpy,
  }),
}))

vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

function clickBody(testid: string) {
  const el = document.body.querySelector<HTMLElement>(`[data-testid="${testid}"]`)
  expect(el, testid).not.toBeNull()
  el!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
}

describe('forwardDialog', () => {
  beforeEach(() => {
    forwardMessagesSpy.mockClear()
    sendMessageSpy.mockClear()
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('forwards a single selected message via forwardMessages (not a no-op)', async () => {
    mount(ForwardDialog, { props: { roomId: '!src:localhost', eventIds: ['$e1'] }, attachTo: document.body })
    await flushPromises()

    clickBody('forward-room-!target:localhost')
    await flushPromises()

    expect(forwardMessagesSpy).toHaveBeenCalledWith('!src:localhost', '!target:localhost', ['$e1'])
  })

  it('merged-forwards multiple selected messages', async () => {
    mount(ForwardDialog, { props: { roomId: '!src:localhost', eventIds: ['$e1', '$e2'] }, attachTo: document.body })
    await flushPromises()

    clickBody('forward-room-!target:localhost')
    await flushPromises()

    expect(forwardMessagesSpy).toHaveBeenCalledWith('!src:localhost', '!target:localhost', ['$e1', '$e2'])
  })
})
