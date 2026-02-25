import { describe, expect, it } from 'vitest'
import { useChatStore } from '@/features/chat/stores/chatStore'

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
})
