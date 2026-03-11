import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

vi.mock('lottie-web', () => ({
  default: {
    loadAnimation: vi.fn(() => ({
      destroy: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  },
}))

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn().mockReturnValue('@me:localhost'),
    mxcUrlToHttp: vi.fn((url: string) => url),
    getRoom: vi.fn(),
    getAccountData: vi.fn().mockReturnValue(null),
  })),
}))

vi.mock('@matrix/media', () => ({
  getThumbnailUrl: vi.fn().mockReturnValue(''),
  downloadMedia: vi.fn(),
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>
  return {
    ...original,
    getReactions: vi.fn().mockReturnValue([]),
    getReadUsers: vi.fn().mockReturnValue([]),
    getThreadReplies: vi.fn().mockReturnValue([]),
    isUserBlocked: vi.fn().mockReturnValue(false),
    redactMessage: vi.fn(),
    sendReaction: vi.fn(),
  }
})

vi.mock('@matrix/rooms', () => ({
  isMessagePinned: vi.fn().mockReturnValue(false),
  isMessageStarred: vi.fn().mockReturnValue(false),
  pinMessage: vi.fn(),
  starMessage: vi.fn(),
  unpinMessage: vi.fn(),
  unstarMessage: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
}))

vi.mock('@/shared/lib/translate', () => ({
  getSystemLanguage: vi.fn().mockReturnValue('en'),
  translateText: vi.fn(),
}))

vi.mock('@/shared/composables/useAuthMedia', () => ({
  useAuthMedia: vi.fn().mockReturnValue({
    getAuthenticatedUrl: vi.fn((url: string) => url),
  }),
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
})

describe('messageBubble', () => {
  const mockTextEvent = {
    getId: () => '$event1',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body: 'Hello World' }),
    getDate: () => new Date('2026-01-01T12:00:00Z'),
    getType: () => 'm.room.message',
    getTs: () => 1735732800000,
    getRoomId: () => '!room1:localhost',
    isRedacted: () => false,
    status: null,
  }

  it('should render text message content', async () => {
    const MessageBubble = (
      await import('@/features/chat/components/MessageBubble.vue')
    ).default
    const wrapper = mount(MessageBubble, {
      props: {
        event: mockTextEvent as any,
        isMine: false,
        showSender: true,
        groupPosition: 'alone',
      },
      global: {
        plugins: [i18n],
        provide: {
          triggerEmojiEffect: vi.fn(),
        },
      },
    })
    expect(wrapper.text()).toContain('Hello World')
  })

  it('should apply correct alignment for non-mine messages', async () => {
    const MessageBubble = (
      await import('@/features/chat/components/MessageBubble.vue')
    ).default
    const wrapper = mount(MessageBubble, {
      props: {
        event: mockTextEvent as any,
        isMine: false,
        showSender: true,
        groupPosition: 'alone',
      },
      global: {
        plugins: [i18n],
        provide: {
          triggerEmojiEffect: vi.fn(),
        },
      },
    })
    // Sender name rendering has moved to ChatMessage group level;
    // MessageBubble itself should still mount correctly and contain content
    expect(wrapper.text()).toContain('Hello World')
    // Non-mine messages should not have right-aligned styling
    expect(wrapper.html()).not.toContain('items-end')
  })
})
