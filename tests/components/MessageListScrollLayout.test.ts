import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

vi.mock('@matrix/index', () => ({
  getReadMarkerEventId: vi.fn().mockReturnValue(null),
  syncState: { value: 'PREPARED' },
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/features/chat/composables/useMessages', () => ({
  useMessages: () => ({
    messages: ref([]),
    isLoading: ref(false),
    hasMore: ref(false),
    loadMore: vi.fn(),
    relationSummaries: ref({
      reactionsByEventId: new Map(),
      threadReplyCountsByEventId: new Map(),
    }),
    timelineVersion: ref(0),
  }),
}))

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
}

class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('message list scroll layout', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('allows the history scroller to shrink inside the chat column', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: true,
          UserInfoPanel: true,
        },
      },
    })

    try {
      await nextTick()

      expect(wrapper.classes()).toContain('min-h-0')
      const scroller = wrapper.get('[data-testid="message-list-scroller"]')
      expect(scroller.classes()).toContain('min-h-0')
      expect(scroller.classes()).toContain('h-full')
    }
    finally {
      wrapper.unmount()
    }
  })
})
