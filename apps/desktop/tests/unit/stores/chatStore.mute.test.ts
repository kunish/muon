import type { RoomSummary } from '@matrix/types'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  collectExpiredMutes,
  getMuteExpiry,
  isMuted,
  muteWithExpiry,
  resetChatStore,
  syncServerState,
  toggleMute,
} from '@/features/chat/stores/chatStore'

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

describe('chatStore timed mute', () => {
  beforeEach(() => {
    localStorage.clear()
    resetChatStore()
  })

  it('mutes with a future expiry and reports muted', () => {
    const needsServerMute = muteWithExpiry(ROOM, Date.now() + 3_600_000)
    expect(needsServerMute).toBe(true)
    expect(isMuted(ROOM)).toBe(true)
    expect(collectExpiredMutes()).not.toContain(ROOM)
  })

  it('treats a passed expiry as no longer muted and collectable for cleanup', () => {
    muteWithExpiry(ROOM, Date.now() - 1000)
    expect(isMuted(ROOM)).toBe(false)
    expect(collectExpiredMutes()).toContain(ROOM)
  })

  it('permanent mute (null expiry) never expires', () => {
    muteWithExpiry(ROOM, null)
    expect(isMuted(ROOM)).toBe(true)
    expect(getMuteExpiry(ROOM)).toBeUndefined()
    expect(collectExpiredMutes()).not.toContain(ROOM)
  })

  it('persists mute expiry across a reload', () => {
    const expiry = Date.now() + 8 * 3_600_000
    muteWithExpiry(ROOM, expiry)

    // resetChatStore() re-reads the persisted mute-expiry from localStorage,
    // reproducing a fresh-store reload.
    resetChatStore()
    // server reconcile keeps the room muted, so expiry survives
    syncServerState([mutedSummary(ROOM, true)])
    expect(getMuteExpiry(ROOM)).toBe(expiry)
    expect(isMuted(ROOM)).toBe(true)
  })

  it('toggleMute off clears the expiry', () => {
    muteWithExpiry(ROOM, Date.now() + 3_600_000)
    toggleMute(ROOM) // turns muted off
    expect(isMuted(ROOM)).toBe(false)
    expect(getMuteExpiry(ROOM)).toBeUndefined()
  })

  it('syncServerState clears stale expiry when server is no longer muted', () => {
    muteWithExpiry(ROOM, Date.now() + 3_600_000)
    // server says this room is NOT muted anymore
    syncServerState([mutedSummary(ROOM, false)])
    expect(getMuteExpiry(ROOM)).toBeUndefined()
    expect(isMuted(ROOM)).toBe(false)
  })
})
