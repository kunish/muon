import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

describe('chatMessage contact card', () => {
  it('renders shared contact cards with the dedicated card UI', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default

    const event = {
      getId: () => '$contact1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'im.muon.contact_card',
        body: '[Contact]',
        'im.muon.contact_card': {
          user_id: '@bob:localhost',
          display_name: 'Bob Stone',
          avatar_url: 'mxc://localhost/bob',
        },
      }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      global: {
        stubs: {
          Avatar: true,
          LinkPreview: true,
          MessageActionBar: true,
          ReactionBar: true,
          AudioMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    expect(wrapper.text()).toContain('Bob Stone')
    expect(wrapper.text()).toContain('@bob:localhost')
    expect(wrapper.html()).toContain('min-w-[220px]')
    expect(wrapper.html()).not.toContain('[Contact]')
  })
})
