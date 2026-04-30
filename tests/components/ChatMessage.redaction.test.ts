import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn(() => '@me:localhost'),
    getRoom: vi.fn(() => ({
      getMember: vi.fn(() => null),
      findEventById: vi.fn(() => null),
    })),
  })),
}))

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

describe('chatMessage redaction updates', () => {
  it('updates redaction state when the timeline refreshes the same MatrixEvent object', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    let redacted = false
    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Delete me' }),
      getTs: () => 1767225600000,
      isRedacted: () => redacted,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
        timelineVersion: 0,
      },
      global: {
        stubs: {
          Avatar: true,
          LinkPreview: true,
          MessageActionBar: true,
          ReactionBar: true,
          AudioMessage: true,
          ContactCardMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Delete me')

    redacted = true
    await wrapper.setProps({ timelineVersion: 1 })

    expect(wrapper.text()).toContain('消息已删除')
    expect(wrapper.text()).not.toContain('Delete me')
  })
})
