import type { RoomSummary } from '@matrix/types'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useChatStore } from '@/features/chat/stores/chatStore'

const ROOM = '!room:localhost'

function mutedSummary(roomId: string, isMuted: boolean): RoomSummary {
  return {
    roomId,
    name: 'Room',
    members: [],
    unreadCount: 0,
    isDirect: false,
    isEncrypted: false,
    isPinned: false,
    isMuted,
    highlightCount: 0,
    memberCount: 1,
  } as unknown as RoomSummary
}

function reloadStore() {
  setActivePinia(createPinia())
  return useChatStore()
}

describe('chatStore timed mute', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('mutes with a future expiry and reports muted', () => {
    const store = useChatStore()
    const needsServerMute = store.muteWithExpiry(ROOM, Date.now() + 3_600_000)
    expect(needsServerMute).toBe(true)
    expect(store.isMuted(ROOM)).toBe(true)
    expect(store.collectExpiredMutes()).not.toContain(ROOM)
  })

  it('treats a passed expiry as no longer muted and collectable for cleanup', () => {
    const store = useChatStore()
    store.muteWithExpiry(ROOM, Date.now() - 1000)
    expect(store.isMuted(ROOM)).toBe(false)
    expect(store.collectExpiredMutes()).toContain(ROOM)
  })

  it('permanent mute (null expiry) never expires', () => {
    const store = useChatStore()
    store.muteWithExpiry(ROOM, null)
    expect(store.isMuted(ROOM)).toBe(true)
    expect(store.getMuteExpiry(ROOM)).toBeUndefined()
    expect(store.collectExpiredMutes()).not.toContain(ROOM)
  })

  it('persists mute expiry across a reload', () => {
    const expiry = Date.now() + 8 * 3_600_000
    const store = useChatStore()
    store.muteWithExpiry(ROOM, expiry)

    const reloaded = reloadStore()
    // server reconcile keeps the room muted, so expiry survives
    reloaded.syncServerState([mutedSummary(ROOM, true)])
    expect(reloaded.getMuteExpiry(ROOM)).toBe(expiry)
    expect(reloaded.isMuted(ROOM)).toBe(true)
  })

  it('toggleMute off clears the expiry', () => {
    const store = useChatStore()
    store.muteWithExpiry(ROOM, Date.now() + 3_600_000)
    store.toggleMute(ROOM) // turns muted off
    expect(store.isMuted(ROOM)).toBe(false)
    expect(store.getMuteExpiry(ROOM)).toBeUndefined()
  })

  it('syncServerState clears stale expiry when server is no longer muted', () => {
    const store = useChatStore()
    store.muteWithExpiry(ROOM, Date.now() + 3_600_000)
    // server says this room is NOT muted anymore
    store.syncServerState([mutedSummary(ROOM, false)])
    expect(store.getMuteExpiry(ROOM)).toBeUndefined()
    expect(store.isMuted(ROOM)).toBe(false)
  })
})
