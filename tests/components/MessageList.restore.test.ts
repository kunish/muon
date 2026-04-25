import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useChatStore } from '@/features/chat/stores/chatStore'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@matrix/index', () => ({
  getReadMarkerEventId: vi.fn(() => null),
}))

const loadMore = vi.fn()

vi.mock('@/features/chat/composables/useMessages', () => ({
  useMessages: () => ({
    messages: ref([]),
    isLoading: ref(false),
    hasMore: ref(false),
    loadMore,
  }),
}))

class ObserverMock {
  observe = vi.fn()
  disconnect = vi.fn()
}

describe('messageList room restore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('IntersectionObserver', ObserverMock)
    vi.stubGlobal('ResizeObserver', ObserverMock)
    vi.stubGlobal('MutationObserver', ObserverMock)
  })

  it('shows an empty room after pending restore completes', async () => {
    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const store = useChatStore()

    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: {
            props: ['roomId'],
            template: '<div data-testid="channel-welcome">Welcome</div>',
          },
          MessageGroup: { template: '<div data-testid="message-group" />' },
          UserInfoPanel: { template: '<div />' },
          ChevronDown: { template: '<span />' },
        },
      },
    })

    store.setCurrentRoom('!empty:localhost')
    await nextTick()
    await nextTick()
    await nextTick()

    expect((wrapper.element as HTMLElement).style.visibility).toBe('visible')
    expect(wrapper.find('[data-testid="channel-welcome"]').exists()).toBe(true)
  })
})
