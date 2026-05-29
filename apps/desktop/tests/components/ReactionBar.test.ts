import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ReactionBar from '@/features/chat/components/ReactionBar.vue'

const NAMES: Record<string, string> = {
  '@alice:localhost': 'Alice',
  '@bob:localhost': 'Bob',
}

const sendReaction = vi.hoisted(() => vi.fn())
const toastError = vi.hoisted(() => vi.fn())

vi.mock('@matrix/index', () => ({
  getReactions: () => [],
  sendReaction,
}))

vi.mock('vue-sonner', () => ({ toast: { error: toastError } }))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRoom: () => ({
      getMember: (userId: string) => (NAMES[userId] ? { name: NAMES[userId] } : null),
    }),
  }),
}))

function mountBar(reactions: any[]) {
  return mount(ReactionBar, {
    props: { eventId: '$e1', roomId: '!room:localhost', reactions },
    global: { stubs: { Teleport: true, Smile: true } },
  })
}

describe('reactionBar reactor tooltip', () => {
  it('shows reactor display names in the pill title', () => {
    const wrapper = mountBar([
      { key: '👍', count: 2, myReaction: false, senders: ['@alice:localhost', '@bob:localhost'] },
    ])
    expect(wrapper.get('.reaction-pill').attributes('title')).toBe('Alice、Bob')
  })

  it('falls back to the local part of a userId without a known member', () => {
    const wrapper = mountBar([{ key: '🎉', count: 1, myReaction: false, senders: ['@carol:localhost'] }])
    expect(wrapper.get('.reaction-pill').attributes('title')).toBe('carol')
  })

  it('renders an empty title when there are no senders', () => {
    const wrapper = mountBar([{ key: '🔥', count: 0, myReaction: false, senders: [] }])
    expect(wrapper.get('.reaction-pill').attributes('title')).toBe('')
  })

  it('surfaces an error toast when sending a reaction fails', async () => {
    sendReaction.mockRejectedValueOnce(new Error('network'))
    const wrapper = mountBar([{ key: '👍', count: 1, myReaction: false, senders: [] }])

    await wrapper.get('.reaction-pill').trigger('click')
    await flushPromises()

    expect(sendReaction).toHaveBeenCalledWith('!room:localhost', '$e1', '👍')
    expect(toastError).toHaveBeenCalled()
  })
})
