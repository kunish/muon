import type { RoomSummary } from '@/matrix/types'
import { describe, expect, it } from 'vitest'
import { useChatStore } from '@/features/chat/stores/chatStore'

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!room:localhost',
    name: 'Room',
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

describe('chatStore', () => {
  it('should have null currentRoomId by default', () => {
    const store = useChatStore()
    expect(store.currentRoomId).toBeNull()
  })

  it('should set current room', () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')

    expect(store.currentRoomId).toBe('!room:localhost')
  })

  it('should clear current room', () => {
    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')
    store.setCurrentRoom(null)

    expect(store.currentRoomId).toBeNull()
  })

  it('should set search query', () => {
    const store = useChatStore()
    store.setSearchQuery('hello')

    expect(store.searchQuery).toBe('hello')
  })

  it('keeps an optimistic pin state while server summaries are stale', () => {
    const store = useChatStore()
    store.togglePin('!room:localhost')

    store.syncServerState([
      createRoom({ roomId: '!room:localhost', isPinned: false }),
    ])

    expect(store.isPinned('!room:localhost')).toBe(true)
  })

  it('keeps route synchronization focused on the current room', () => {
    const store = useChatStore()

    store.selectRoomFromHistory('!bob:localhost')
    store.setCurrentRoomFromRoute('!bob:localhost')

    expect(store.currentRoomId).toBe('!bob:localhost')

    store.setCurrentRoomFromRoute('!alice:localhost')

    expect(store.currentRoomId).toBe('!alice:localhost')
  })

  it('accepts placement hints without changing current room semantics', () => {
    const store = useChatStore()

    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    store.selectRoomFromHistory('!alice:localhost')
    store.setCurrentRoomFromRoute('!alice:localhost')

    expect(store.currentRoomId).toBe('!alice:localhost')
  })

  it('records a local promotion time only for promoted room openings', () => {
    const store = useChatStore()

    store.setCurrentRoom('!alice:localhost')
    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    store.selectRoomFromHistory('!carol:localhost')

    expect(store.getSidebarPromotionTime('!alice:localhost')).toBeUndefined()
    expect(store.getSidebarPromotionTime('!bob:localhost')).toEqual(expect.any(Number))
    expect(store.getSidebarPromotionTime('!carol:localhost')).toBeUndefined()
  })

  it('clears sidebar search and filters when promoting an opened conversation', () => {
    const store = useChatStore()

    store.setFilter('unread')
    store.setSearchQuery('alice')
    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })

    expect(store.activeFilter).toBe('all')
    expect(store.searchQuery).toBe('')
  })

  it('can clear local promotion times when message order takes over again', () => {
    const store = useChatStore()

    store.setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    store.clearSidebarPromotions()

    expect(store.getSidebarPromotionTime('!bob:localhost')).toBeUndefined()
  })
})
