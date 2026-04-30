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

describe('chatMessage mention context', () => {
  it('dims timeline mentions for users outside the current room', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$mention1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.text',
        body: '@小红 @小伟',
        format: 'org.matrix.custom.html',
        formatted_body: '<p><a href="https://matrix.to/#/@alice:localhost">小红</a> <a href="https://matrix.to/#/@edward:localhost">小伟</a></p>',
      }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!group_family:localhost',
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

    const links = [...wrapper.element.querySelectorAll('a[href^="https://matrix.to"]')]
    expect(links).toHaveLength(2)
    expect(links[0].classList.contains('mention-out-of-context')).toBe(false)
    expect(links[0].classList.contains('opacity-50')).toBe(false)
    expect(links[1].classList.contains('mention-out-of-context')).toBe(true)
    expect(links[1].classList.contains('opacity-50')).toBe(true)
  })
})
