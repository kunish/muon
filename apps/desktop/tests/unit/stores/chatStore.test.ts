import type { RoomSummary } from '@/matrix/types'
import { describe, expect, it } from 'vitest'
import {
  chatStore,
  clearSidebarPromotions,
  getSidebarPromotionTime,
  isPinned,
  selectRoomFromHistory,
  setCurrentRoom,
  setCurrentRoomFromRoute,
  setFilter,
  setSearchQuery,
  syncServerState,
  togglePin,
} from '@/features/chat/stores/chatStore'

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

// chatStore is reset before each test by the global test setup.

describe('chatStore', () => {
  it('should have null currentRoomId by default', () => {
    expect(chatStore.state.currentRoomId).toBeNull()
  })

  it('should set current room', () => {
    setCurrentRoom('!room:localhost')
    expect(chatStore.state.currentRoomId).toBe('!room:localhost')
  })

  it('should clear current room', () => {
    setCurrentRoom('!room:localhost')
    setCurrentRoom(null)
    expect(chatStore.state.currentRoomId).toBeNull()
  })

  it('should set search query', () => {
    setSearchQuery('hello')
    expect(chatStore.state.searchQuery).toBe('hello')
  })

  it('keeps an optimistic pin state while server summaries are stale', () => {
    togglePin('!room:localhost')
    syncServerState([createRoom({ roomId: '!room:localhost', isPinned: false })])
    expect(isPinned('!room:localhost')).toBe(true)
  })

  it('keeps route synchronization focused on the current room', () => {
    selectRoomFromHistory('!bob:localhost')
    setCurrentRoomFromRoute('!bob:localhost')
    expect(chatStore.state.currentRoomId).toBe('!bob:localhost')

    setCurrentRoomFromRoute('!alice:localhost')
    expect(chatStore.state.currentRoomId).toBe('!alice:localhost')
  })

  it('accepts placement hints without changing current room semantics', () => {
    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    selectRoomFromHistory('!alice:localhost')
    setCurrentRoomFromRoute('!alice:localhost')
    expect(chatStore.state.currentRoomId).toBe('!alice:localhost')
  })

  it('records a local promotion time only for promoted room openings', () => {
    setCurrentRoom('!alice:localhost')
    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    selectRoomFromHistory('!carol:localhost')

    expect(getSidebarPromotionTime('!alice:localhost')).toBeUndefined()
    expect(getSidebarPromotionTime('!bob:localhost')).toEqual(expect.any(Number))
    expect(getSidebarPromotionTime('!carol:localhost')).toBeUndefined()
  })

  it('clears sidebar search and filters when promoting an opened conversation', () => {
    setFilter('unread')
    setSearchQuery('alice')
    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })

    expect(chatStore.state.activeFilter).toBe('all')
    expect(chatStore.state.searchQuery).toBe('')
  })

  it('can clear local promotion times when message order takes over again', () => {
    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    clearSidebarPromotions()
    expect(getSidebarPromotionTime('!bob:localhost')).toBeUndefined()
  })
})
