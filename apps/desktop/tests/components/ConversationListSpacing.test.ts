import type { RoomSummary } from '@/matrix/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import ConversationList from '@/features/chat/components/ConversationList.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const rooms = vi.hoisted<RoomSummary[]>(() => [])
const routeParams = vi.hoisted<Record<string, string>>(() => ({}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getUserId: () => '@tester:localhost',
    getUser: () => null,
  }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: routeParams }),
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    conversations: computed(() => rooms),
    pinnedCount: computed(() => 0),
    isLoading: ref(false),
  }),
}))

vi.mock('@/features/chat/composables/useGlobalTyping', () => ({
  useGlobalTyping: () => ({
    getTypingUsers: () => [],
  }),
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
    name: 'Alice Wang',
    lastMessage: 'hello',
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

function mountConversationList() {
  return mount(ConversationList, {
    global: {
      stubs: {
        Avatar: true,
        ConversationContextMenu: true,
        NewChatDialog: true,
        UserInfoPanel: true,
        Search: true,
        MessageSquarePlus: true,
        Badge: true,
        BellOff: true,
        FileText: true,
        Film: true,
        Image: true,
        Lock: true,
        Mic: true,
        Pin: true,
        Transition: passthroughStub('Transition'),
        Teleport: passthroughStub('Teleport'),
      },
    },
  })
}

describe('conversation list spacing', () => {
  beforeEach(() => {
    for (const key of Object.keys(routeParams))
      delete routeParams[key]
    rooms.splice(
      0,
      rooms.length,
      createRoom({ roomId: '!alice:localhost', name: 'Alice Wang' }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob Li' }),
    )
  })

  it('renders conversation rows in normal compact flow without virtual spacer gaps', () => {
    const wrapper = mountConversationList()

    const rows = wrapper.findAllComponents({ name: 'ConversationItem' })
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.classes()).not.toContain('absolute')
      expect(row.attributes('style') ?? '').not.toContain('translateY')
    }
  })

  it('renders the header avatar without a border ring', () => {
    const wrapper = mountConversationList()
    const headerAvatar = wrapper.findComponent({ name: 'Avatar' })

    expect(headerAvatar.classes()).toEqual(expect.arrayContaining(['h-8', 'w-8']))
    expect(headerAvatar.classes()).not.toContain('ring-1')
    expect(headerAvatar.classes()).not.toContain('ring-border/30')
  })

  it('does not use the generic clickable avatar hover chrome in the header', () => {
    const wrapper = mountConversationList()
    const headerAvatar = wrapper.findComponent({ name: 'Avatar' })

    expect(headerAvatar.props('clickable')).not.toBe(true)
    expect(headerAvatar.classes()).toContain('cursor-pointer')
  })

  it('does not use the generic clickable avatar hover chrome in conversation rows', () => {
    const wrapper = mountConversationList()
    const firstRow = wrapper.findAllComponents({ name: 'ConversationItem' })[0]
    const rowAvatar = firstRow.getComponent({ name: 'Avatar' })

    expect(rowAvatar.props('clickable')).not.toBe(true)
    expect(rowAvatar.classes()).toContain('cursor-pointer')
  })

  it('shows only pinned direct conversations in the quick access contact strip', () => {
    rooms.splice(
      0,
      rooms.length,
      createRoom({ roomId: '!recent-dm:localhost', name: 'Recent DM' }),
      createRoom({
        roomId: '!pinned-dm:localhost',
        name: 'Pinned DM',
        isPinned: true,
      }),
      createRoom({
        roomId: '!pinned-group:localhost',
        name: 'Pinned Group',
        isDirect: false,
        isPinned: true,
        members: ['@alice:localhost', '@bob:localhost'],
        memberCount: 3,
      }),
    )
    const store = useChatStore()
    store.syncServerState(rooms)

    const wrapper = mountConversationList()

    expect(wrapper.find('button[title="Pinned DM"]').exists()).toBe(true)
    expect(wrapper.find('button[title="Recent DM"]').exists()).toBe(false)
    expect(wrapper.find('button[title="Pinned Group"]').exists()).toBe(false)
  })

  it('left-aligns pinned quick access contacts without stretching them across the strip', () => {
    rooms.splice(
      0,
      rooms.length,
      createRoom({
        roomId: '!pinned-dm:localhost',
        name: 'Pinned DM',
        isPinned: true,
      }),
    )
    const store = useChatStore()
    store.syncServerState(rooms)

    const wrapper = mountConversationList()
    const quickContact = wrapper.get('button[title="Pinned DM"]')

    expect(quickContact.classes()).not.toContain('flex-1')
    expect(quickContact.classes()).toContain('shrink-0')
  })

  it('does not use the generic clickable avatar hover chrome in quick access contacts', () => {
    rooms.splice(
      0,
      rooms.length,
      createRoom({
        roomId: '!pinned-dm:localhost',
        name: 'Pinned DM',
        isPinned: true,
      }),
    )
    const store = useChatStore()
    store.syncServerState(rooms)

    const wrapper = mountConversationList()
    const quickAvatar = wrapper.get('button[title="Pinned DM"]').getComponent({ name: 'Avatar' })

    expect(quickAvatar.props('clickable')).not.toBe(true)
    expect(quickAvatar.classes()).toContain('cursor-pointer')
  })

  it('highlights the contact from the current chat when the route param is stale', () => {
    rooms.splice(
      0,
      rooms.length,
      createRoom({ roomId: '!old:localhost', name: 'Old Contact' }),
      createRoom({ roomId: '!current:localhost', name: 'Current Contact' }),
    )
    routeParams.roomId = '!old:localhost'

    const store = useChatStore()
    store.setCurrentRoom('!current:localhost')

    const wrapper = mountConversationList()
    const rows = wrapper.findAllComponents({ name: 'ConversationItem' })
    const oldRow = rows.find(row => row.props('room').roomId === '!old:localhost')
    const currentRow = rows.find(row => row.props('room').roomId === '!current:localhost')

    expect(oldRow?.props('active')).toBe(false)
    expect(currentRow?.props('active')).toBe(true)
  })

  it('shows an encrypted-message preview instead of no-messages for undecrypted latest events', () => {
    rooms.splice(
      0,
      rooms.length,
      createRoom({
        roomId: '!encrypted:localhost',
        name: 'Encrypted Room',
        isEncrypted: true,
        lastMessage: undefined,
        lastMessageType: 'm.room.encrypted',
        unreadCount: 3,
      }),
    )

    const wrapper = mountConversationList()

    expect(wrapper.text()).toContain('加密消息')
    expect(wrapper.text()).not.toContain('暂无消息')
  })
})
