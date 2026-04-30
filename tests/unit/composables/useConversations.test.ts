import type { RoomSummary } from '@/matrix/types'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useConversations } from '@/features/chat/composables/useConversations'
import { useChatStore } from '@/features/chat/stores/chatStore'

const roomSummaries = vi.hoisted<RoomSummary[]>(() => [])
const matrixEventsOn = vi.hoisted(() => vi.fn())

vi.mock('@matrix/index', () => ({
  getRoomSummaries: () => roomSummaries,
  matrixEvents: {
    on: matrixEventsOn,
  },
}))

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!room:localhost',
    name: 'Room',
    lastMessage: 'hello',
    lastMessageTs: 0,
    unreadCount: 0,
    isDirect: true,
    isEncrypted: false,
    members: ['@tester:localhost'],
    isPinned: false,
    isMuted: false,
    highlightCount: 0,
    memberCount: 2,
    ...overrides,
  }
}

function mountUseConversationsHarness() {
  return mount(defineComponent({
    name: 'UseConversationsHarness',
    setup() {
      const { conversations, pinnedCount } = useConversations()

      return () => h('ol', conversations.value.map((room, index) =>
        h('li', {
          'data-room-id': room.roomId,
          'data-pinned-boundary': index === pinnedCount.value ? 'true' : undefined,
        }, room.name),
      ))
    },
  }))
}

describe('useConversations', () => {
  beforeEach(() => {
    localStorage.clear()
    roomSummaries.splice(0, roomSummaries.length)
    matrixEventsOn.mockClear()
  })

  it('moves an explicitly promoted chat contact to the first sidebar row', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
    )

    const store = useChatStore()
    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map(row => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })

  it('keeps history order when the current room changes without sidebar promotion', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    const store = useChatStore()
    store.setCurrentRoom('!bob:localhost')

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map(row => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
      '!bob:localhost',
    ])
  })

  it('preserves an existing promoted contact when selecting another history conversation', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    const store = useChatStore()
    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    store.selectRoomFromHistory('!alice:localhost')
    store.setCurrentRoomFromRoute('!alice:localhost')
    await nextTick()

    expect(store.currentRoomId).toBe('!alice:localhost')
    expect(wrapper.findAll('li').map(row => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })
})
