import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn(() => '@me:localhost'),
    getRoom: vi.fn(() => ({
      getJoinedMembers: vi.fn(() => []),
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

vi.mock('@/shared/composables/useAuthMedia', () => ({
  useAuthMedia: () => ref(undefined),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

function createStickerEvent(): MatrixEvent {
  return {
    getId: () => '$sticker',
    getType: () => 'm.sticker',
    getSender: () => '@alice:localhost',
    getContent: () => ({
      body: 'party sticker',
      url: 'mxc://server/sticker-id',
      info: {
        mimetype: 'image/gif',
        w: 512,
        h: 256,
      },
    }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  } as unknown as MatrixEvent
}

describe('chat message sticker layout', () => {
  it('reserves image sticker dimensions before the authenticated media source resolves', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
    const wrapper = mount(ChatMessage, {
      props: {
        event: createStickerEvent(),
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
        },
      },
    })

    const frame = wrapper.get('[data-testid="image-sticker-frame"]')
    expect(frame.attributes('style')).toContain('width: 220px')
    expect(frame.attributes('style')).toContain('max-width: 100%')
    expect(frame.attributes('style')).toContain('aspect-ratio: 512 / 256')

    wrapper.unmount()
  })
})
