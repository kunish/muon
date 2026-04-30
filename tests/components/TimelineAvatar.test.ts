import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

function createTextEvent() {
  return {
    getId: () => '$timeline-avatar',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  }
}

describe('timeline avatar', () => {
  it('does not use the generic clickable avatar hover chrome on message rows', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default

    const wrapper = mount(ChatMessage, {
      props: {
        event: createTextEvent() as any,
        isFirst: true,
        roomId: '!dm_alice:localhost',
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

    const avatar = wrapper.getComponent({ name: 'Avatar' })
    expect(avatar.props('clickable')).not.toBe(true)
    expect(avatar.classes()).toContain('cursor-pointer')
  })

  it('does not use the generic clickable avatar hover chrome on grouped timeline avatars', async () => {
    const MessageGroupAvatar = (await import('@/features/chat/components/MessageGroupAvatar.vue')).default

    const wrapper = mount(MessageGroupAvatar, {
      props: {
        senderId: '@alice:localhost',
        roomId: '!dm_alice:localhost',
      },
      global: {
        stubs: {
          Avatar: true,
        },
      },
    })

    const avatar = wrapper.getComponent({ name: 'Avatar' })
    expect(avatar.props('clickable')).not.toBe(true)
    expect(avatar.classes()).toContain('cursor-pointer')
  })
})
