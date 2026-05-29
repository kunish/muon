import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { getReactionsMock, getThreadRepliesMock } = vi.hoisted(() => ({
  getReactionsMock: vi.fn().mockReturnValue([]),
  getThreadRepliesMock: vi.fn().mockReturnValue([]),
}))

vi.mock('@matrix/index', () => ({
  getReactions: getReactionsMock,
  getThreadReplies: getThreadRepliesMock,
  redactMessage: vi.fn(),
  sendReaction: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

describe('chatMessage relation summaries', () => {
  it('uses precomputed reactions and thread count without rescanning the room timeline', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
        reactions: [{ key: '👍', count: 2, myReaction: true, senders: ['@alice:localhost', '@bob:localhost'] }],
        threadReplyCount: 3,
      },
      global: {
        stubs: {
          Avatar: true,
          LinkPreview: true,
          MessageActionBar: true,
          AudioMessage: true,
          ContactCardMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    expect(getReactionsMock).not.toHaveBeenCalled()
    expect(getThreadRepliesMock).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('3')
    expect(wrapper.text()).toContain('👍')
  })
})
