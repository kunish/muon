import type { RoomSummary } from '@/matrix/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import ConversationList from '@/features/chat/components/ConversationList.vue'

const rooms = vi.hoisted<RoomSummary[]>(() => [])
const unreadCount = vi.hoisted(() => ({ value: 0 }))
const markAllRead = vi.hoisted(() => vi.fn())

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getUserId: () => '@tester:localhost',
    getUser: () => null,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    conversations: computed(() => rooms),
    pinnedCount: computed(() => 0),
    isLoading: ref(false),
    totalUnreadCount: computed(() => unreadCount.value),
    markAllRead,
  }),
}))

vi.mock('@/features/chat/composables/useGlobalTyping', () => ({
  useGlobalTyping: () => ({ getTypingUsers: () => [] }),
}))

function passthroughStub(name: string) {
  return defineComponent({
    name,
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  })
}

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!alice:localhost',
    name: 'Alice',
    lastMessage: 'hi',
    lastMessageTs: 1767225600000,
    unreadCount: 0,
    isDirect: true,
    isEncrypted: false,
    members: ['@alice:localhost'],
    isPinned: false,
    isMuted: false,
    highlightCount: 0,
    memberCount: 2,
    ...overrides,
  }
}

function mountList() {
  return mount(ConversationList, {
    global: {
      stubs: {
        Avatar: true,
        ConversationContextMenu: true,
        NewChatDialog: true,
        UserInfoPanel: true,
        Search: true,
        MessageSquarePlus: true,
        CheckCheck: true,
        Transition: passthroughStub('Transition'),
        Teleport: passthroughStub('Teleport'),
      },
    },
  })
}

describe('conversation list mark all read', () => {
  beforeEach(() => {
    markAllRead.mockClear()
    unreadCount.value = 0
    rooms.splice(0, rooms.length, createRoom({ roomId: '!a:localhost', unreadCount: 3 }))
  })

  it('shows the mark-all-read action only when there are unread conversations', () => {
    unreadCount.value = 0
    expect(mountList().find('[data-testid="conversation-mark-all-read"]').exists()).toBe(false)

    unreadCount.value = 5
    expect(mountList().find('[data-testid="conversation-mark-all-read"]').exists()).toBe(true)
  })

  it('invokes markAllRead when the action is clicked', async () => {
    unreadCount.value = 5
    const wrapper = mountList()
    await wrapper.find('[data-testid="conversation-mark-all-read"]').trigger('click')
    expect(markAllRead).toHaveBeenCalledTimes(1)
  })
})
