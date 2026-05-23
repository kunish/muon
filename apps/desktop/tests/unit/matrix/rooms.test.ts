import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

function makeMockRoom(overrides: Record<string, any> = {}) {
  return {
    roomId: '!test:localhost',
    name: 'Test Room',
    tags: {},
    currentState: {
      getStateEvents: vi.fn().mockReturnValue(null),
    },
    getMyMembership: () => 'join',
    getJoinedMembers: () => [],
    getJoinedMemberCount: () => 1,
    getMxcAvatarUrl: () => null,
    getLiveTimeline: () => ({
      getEvents: () => [],
    }),
    getUnreadNotificationCount: () => 0,
    getMember: vi.fn().mockReturnValue(null),
    ...overrides,
  }
}

describe('matrix rooms', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getRoom).mockReturnValue(makeMockRoom())
    ;(mockClient as any).pushRules = { global: { override: [] } }
    vi.mocked(mockClient.getRooms).mockReturnValue([])
    vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
  })

  describe('toggleRoomPin', () => {
    it('should pin a room when it is not pinned (set m.favourite tag)', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(makeMockRoom({ tags: {} }))

      const { toggleRoomPin } = await import('@/matrix/rooms')
      const result = await toggleRoomPin('!test:localhost')

      expect(mockClient.setRoomTag).toHaveBeenCalledWith('!test:localhost', 'm.favourite', { order: 0.5 })
      expect(mockClient.deleteRoomTag).not.toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should unpin a room when it is already pinned (delete m.favourite tag)', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(makeMockRoom({ tags: { 'm.favourite': { order: 0.5 } } }))

      const { toggleRoomPin } = await import('@/matrix/rooms')
      const result = await toggleRoomPin('!test:localhost')

      expect(mockClient.deleteRoomTag).toHaveBeenCalledWith('!test:localhost', 'm.favourite')
      expect(mockClient.setRoomTag).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should return false when room does not exist', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { toggleRoomPin } = await import('@/matrix/rooms')
      const result = await toggleRoomPin('!missing:localhost')

      expect(result).toBe(false)
      expect(mockClient.setRoomTag).not.toHaveBeenCalled()
      expect(mockClient.deleteRoomTag).not.toHaveBeenCalled()
    })
  })

  describe('toggleRoomMute', () => {
    it('should mute a room (add push rule override)', async () => {
      ;(mockClient as any).pushRules = {
        global: { override: [] },
      } as any

      const { toggleRoomMute } = await import('@/matrix/rooms')
      const result = await toggleRoomMute('!test:localhost')

      expect(mockClient.addPushRule).toHaveBeenCalledWith('global', 'override', '!test:localhost', {
        conditions: [{ kind: 'event_match', key: 'room_id', pattern: '!test:localhost' }],
        actions: ['dont_notify'],
      })
      expect(mockClient.deletePushRule).not.toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should unmute a room (delete push rule override)', async () => {
      ;(mockClient as any).pushRules = {
        global: {
          override: [
            {
              rule_id: '!test:localhost',
              actions: ['dont_notify'],
            },
          ],
        },
      } as any

      const { toggleRoomMute } = await import('@/matrix/rooms')
      const result = await toggleRoomMute('!test:localhost')

      expect(mockClient.deletePushRule).toHaveBeenCalledWith('global', 'override', '!test:localhost')
      expect(mockClient.addPushRule).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should mute when pushRules is missing', async () => {
      ;(mockClient as any).pushRules = null as any

      const { toggleRoomMute } = await import('@/matrix/rooms')
      const result = await toggleRoomMute('!test:localhost')

      expect(mockClient.addPushRule).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should handle unmute when pushRules override array is not present', async () => {
      ;(mockClient as any).pushRules = {
        global: {},
      } as any

      const { toggleRoomMute } = await import('@/matrix/rooms')
      const result = await toggleRoomMute('!test:localhost')

      expect(mockClient.addPushRule).toHaveBeenCalled()
      expect(result).toBe(true)
    })
  })

  describe('leaveRoom', () => {
    it('should leave a room via the SDK', async () => {
      const { leaveRoom } = await import('@/matrix/rooms')
      await leaveRoom('!test:localhost')

      expect(mockClient.leave).toHaveBeenCalledWith('!test:localhost')
    })
  })

  describe('setRoomName / setRoomTopic / getRoomTopic', () => {
    it('should set the room name', async () => {
      const { setRoomName } = await import('@/matrix/rooms')
      await setRoomName('!test:localhost', 'New Name')

      expect(mockClient.setRoomName).toHaveBeenCalledWith('!test:localhost', 'New Name')
    })

    it('should set the room topic', async () => {
      const { setRoomTopic } = await import('@/matrix/rooms')
      await setRoomTopic('!test:localhost', 'New Topic')

      expect(mockClient.setRoomTopic).toHaveBeenCalledWith('!test:localhost', 'New Topic')
    })

    it('should get the room topic', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ topic: 'My Topic' }) }),
          },
        }),
      )

      const { getRoomTopic } = await import('@/matrix/rooms')
      const topic = getRoomTopic('!test:localhost')

      expect(topic).toBe('My Topic')
    })

    it('should return empty string when room not found for topic', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getRoomTopic } = await import('@/matrix/rooms')
      const topic = getRoomTopic('!missing:localhost')

      expect(topic).toBe('')
    })

    it('should return empty string when no topic event exists', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue(null),
          },
        }),
      )

      const { getRoomTopic } = await import('@/matrix/rooms')
      const topic = getRoomTopic('!test:localhost')

      expect(topic).toBe('')
    })
  })

  describe('room announcement', () => {
    it('should set the room announcement', async () => {
      const { setRoomAnnouncement } = await import('@/matrix/rooms')
      await setRoomAnnouncement('!test:localhost', 'Welcome everyone!')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'im.muon.announcement', {
        body: 'Welcome everyone!',
      })
    })

    it('should get the room announcement', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ body: 'Announcement text' }) }),
          },
        }),
      )

      const { getRoomAnnouncement } = await import('@/matrix/rooms')
      const announcement = getRoomAnnouncement('!test:localhost')

      expect(announcement).toBe('Announcement text')
    })

    it('should return empty string when room not found', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getRoomAnnouncement } = await import('@/matrix/rooms')
      const announcement = getRoomAnnouncement('!missing:localhost')

      expect(announcement).toBe('')
    })

    it('should return empty string when no announcement event exists', async () => {
      const { getRoomAnnouncement } = await import('@/matrix/rooms')
      const announcement = getRoomAnnouncement('!test:localhost')

      expect(announcement).toBe('')
    })
  })

  describe('message retention', () => {
    it('should set message retention with a max lifetime', async () => {
      const { setMessageRetention } = await import('@/matrix/rooms')
      await setMessageRetention('!test:localhost', 86400000)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'im.muon.message_retention', {
        enabled: true,
        max_lifetime: 86400000,
      })
    })

    it('should disable message retention when maxLifetimeMs is null', async () => {
      const { setMessageRetention } = await import('@/matrix/rooms')
      await setMessageRetention('!test:localhost', null)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'im.muon.message_retention', {
        enabled: false,
      })
    })

    it('should get message retention settings', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: () => ({ enabled: true, max_lifetime: 604800000 }),
            }),
          },
        }),
      )

      const { getMessageRetention } = await import('@/matrix/rooms')
      const retention = getMessageRetention('!test:localhost')

      expect(retention).toEqual({ enabled: true, maxLifetime: 604800000 })
    })

    it('should return null when room not found for retention', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getMessageRetention } = await import('@/matrix/rooms')
      const retention = getMessageRetention('!missing:localhost')

      expect(retention).toBeNull()
    })

    it('should return null when no retention event exists', async () => {
      const { getMessageRetention } = await import('@/matrix/rooms')
      const retention = getMessageRetention('!test:localhost')

      expect(retention).toBeNull()
    })
  })

  describe('pinned messages', () => {
    it('should pin a message', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ pinned: ['$existing'] }) }),
          },
        }),
      )

      const { pinMessage } = await import('@/matrix/rooms')
      await pinMessage('!test:localhost', '$new_pin')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'm.room.pinned_events', {
        pinned: ['$existing', '$new_pin'],
      })
    })

    it('should not duplicate an already pinned message', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ pinned: ['$existing'] }) }),
          },
        }),
      )

      const { pinMessage } = await import('@/matrix/rooms')
      await pinMessage('!test:localhost', '$existing')

      expect(mockClient.sendStateEvent).not.toHaveBeenCalled()
    })

    it('should unpin a message', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ pinned: ['$a', '$b', '$c'] }) }),
          },
        }),
      )

      const { unpinMessage } = await import('@/matrix/rooms')
      await unpinMessage('!test:localhost', '$b')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'm.room.pinned_events', {
        pinned: ['$a', '$c'],
      })
    })

    it('should not unpin a message that is not pinned', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ pinned: ['$a'] }) }),
          },
        }),
      )

      const { unpinMessage } = await import('@/matrix/rooms')
      await unpinMessage('!test:localhost', '$not_pinned')

      expect(mockClient.sendStateEvent).not.toHaveBeenCalled()
    })

    it('should check if a message is pinned', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({ getContent: () => ({ pinned: ['$a', '$b'] }) }),
          },
        }),
      )

      const { isMessagePinned } = await import('@/matrix/rooms')
      expect(isMessagePinned('!test:localhost', '$a')).toBe(true)
      expect(isMessagePinned('!test:localhost', '$c')).toBe(false)
    })

    it('should return false for pin check when room does not exist', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { isMessagePinned } = await import('@/matrix/rooms')
      expect(isMessagePinned('!missing:localhost', '$a')).toBe(false)
    })
  })

  describe('starred messages', () => {
    it('should star a message', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({ starred: [{ roomId: '!other:localhost', eventId: '$other' }] }),
      } as any)

      const { starMessage } = await import('@/matrix/rooms')
      await starMessage('!test:localhost', '$new_star')

      expect(mockClient.setAccountData).toHaveBeenCalledWith('im.muon.starred', {
        starred: [
          { roomId: '!other:localhost', eventId: '$other' },
          { roomId: '!test:localhost', eventId: '$new_star' },
        ],
      })
    })

    it('should not star a message that is already starred', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({ starred: [{ roomId: '!test:localhost', eventId: '$existing' }] }),
      } as any)

      const { starMessage } = await import('@/matrix/rooms')
      await starMessage('!test:localhost', '$existing')

      expect(mockClient.setAccountData).not.toHaveBeenCalled()
    })

    it('should unstar a message', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          starred: [
            { roomId: '!test:localhost', eventId: '$a' },
            { roomId: '!test:localhost', eventId: '$b' },
          ],
        }),
      } as any)

      const { unstarMessage } = await import('@/matrix/rooms')
      await unstarMessage('!test:localhost', '$a')

      expect(mockClient.setAccountData).toHaveBeenCalledWith('im.muon.starred', {
        starred: [{ roomId: '!test:localhost', eventId: '$b' }],
      })
    })

    it('should check if a message is starred', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          starred: [{ roomId: '!test:localhost', eventId: '$starred' }],
        }),
      } as any)

      const { isMessageStarred } = await import('@/matrix/rooms')
      expect(isMessageStarred('!test:localhost', '$starred')).toBe(true)
      expect(isMessageStarred('!test:localhost', '$not_starred')).toBe(false)
      expect(isMessageStarred('!other:localhost', '$starred')).toBe(false)
    })
  })

  describe('voice channel state', () => {
    it('should set voice channel enabled state', async () => {
      const { setVoiceChannelState } = await import('@/matrix/rooms')
      await setVoiceChannelState('!test:localhost', true)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'im.muon.voice_channel', {
        enabled: true,
      })
    })

    it('should set voice channel disabled state', async () => {
      const { setVoiceChannelState } = await import('@/matrix/rooms')
      await setVoiceChannelState('!test:localhost', false)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!test:localhost', 'im.muon.voice_channel', {
        enabled: false,
      })
    })

    it('should get voice channel state', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          currentState: {
            getStateEvents: vi.fn().mockReturnValue({
              getContent: () => ({ enabled: true }),
            }),
          },
        }),
      )

      const { getVoiceChannelState } = await import('@/matrix/rooms')
      const state = getVoiceChannelState('!test:localhost')

      expect(state).toEqual({ enabled: true })
    })

    it('should return null when room not found for voice state', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getVoiceChannelState } = await import('@/matrix/rooms')
      const state = getVoiceChannelState('!missing:localhost')

      expect(state).toBeNull()
    })

    it('should return null when no voice channel event exists', async () => {
      const { getVoiceChannelState } = await import('@/matrix/rooms')
      const state = getVoiceChannelState('!test:localhost')

      expect(state).toBeNull()
    })
  })

  describe('findOrCreateDm', () => {
    it('should return existing joined DM room from m.direct', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!dm_alice:localhost'],
        }),
      } as any)
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          roomId: '!dm_alice:localhost',
          getMyMembership: () => 'join',
        }),
      )

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      expect(roomId).toBe('!dm_alice:localhost')
      expect(mockClient.createRoom).not.toHaveBeenCalled()
    })

    it('should rejoin a previously left DM room', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!dm_alice:localhost'],
        }),
      } as any)
      vi.mocked(mockClient.getRoom).mockReturnValue(
        makeMockRoom({
          roomId: '!dm_alice:localhost',
          getMyMembership: () => 'leave',
        }),
      )
      vi.mocked(mockClient.joinRoom).mockResolvedValue({ roomId: '!dm_alice:localhost' } as any)

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      expect(roomId).toBe('!dm_alice:localhost')
      expect(mockClient.joinRoom).toHaveBeenCalledWith('!dm_alice:localhost')
    })

    it('should rejoin a DM room not in local store', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!dm_alice:localhost'],
        }),
      } as any)
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)
      vi.mocked(mockClient.joinRoom).mockResolvedValue({ roomId: '!dm_alice:localhost' } as any)

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      expect(roomId).toBe('!dm_alice:localhost')
      expect(mockClient.joinRoom).toHaveBeenCalledWith('!dm_alice:localhost')
    })

    it('should find implicit 1:1 DM room from joined rooms', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)
      vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
      vi.mocked(mockClient.getRooms).mockReturnValue([
        makeMockRoom({
          roomId: '!implicit_dm:localhost',
          getMyMembership: () => 'join',
          getJoinedMembers: () => [
            { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
            { userId: '@alice:localhost', name: 'Alice', getMxcAvatarUrl: () => null },
          ],
        }),
      ])

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      expect(roomId).toBe('!implicit_dm:localhost')
      expect(mockClient.setAccountData).toHaveBeenCalledWith('m.direct', {
        '@alice:localhost': ['!implicit_dm:localhost'],
      })
      expect(mockClient.createRoom).not.toHaveBeenCalled()
    })

    it('should create a new DM room when none exists', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)
      vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
      vi.mocked(mockClient.getRooms).mockReturnValue([])
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!new_dm:localhost' } as any)

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      expect(roomId).toBe('!new_dm:localhost')
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        is_direct: true,
        invite: ['@alice:localhost'],
        preset: 'trusted_private_chat',
      })
      expect(mockClient.setAccountData).toHaveBeenCalledWith('m.direct', {
        '@alice:localhost': ['!new_dm:localhost'],
      })
    })

    it('should skip non-1:1 rooms when searching implicit DMs', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)
      vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
      // Group room with 3 members — not a 1:1 DM
      vi.mocked(mockClient.getRooms).mockReturnValue([
        makeMockRoom({
          roomId: '!group:localhost',
          getMyMembership: () => 'join',
          getJoinedMembers: () => [
            { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
            { userId: '@alice:localhost', name: 'Alice', getMxcAvatarUrl: () => null },
            { userId: '@bob:localhost', name: 'Bob', getMxcAvatarUrl: () => null },
          ],
        }),
      ])
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!new_dm:localhost' } as any)

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      // Falls through to create new room because 3-member room is not 1:1
      expect(roomId).toBe('!new_dm:localhost')
    })

    it('should handle joinRoom failure and try implicit search', async () => {
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({
          '@alice:localhost': ['!left_dm:localhost'],
        }),
      } as any)
      // This room is "leave" status and joinRoom will fail
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!left_dm:localhost') {
          return makeMockRoom({
            roomId: '!left_dm:localhost',
            getMyMembership: () => 'leave',
          })
        }
        if (rid === '!implicit_dm:localhost') {
          return makeMockRoom({
            roomId: '!implicit_dm:localhost',
            getMyMembership: () => 'join',
          })
        }
        return null
      })
      vi.mocked(mockClient.joinRoom).mockRejectedValue(new Error('Room deleted'))
      // Add implicit 1:1 room for fallback
      vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
      vi.mocked(mockClient.getRooms).mockReturnValue([
        makeMockRoom({
          roomId: '!implicit_dm:localhost',
          getMyMembership: () => 'join',
          getJoinedMembers: () => [
            { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
            { userId: '@alice:localhost', name: 'Alice', getMxcAvatarUrl: () => null },
          ],
        }),
      ])

      const { findOrCreateDm } = await import('@/matrix/rooms')
      const roomId = await findOrCreateDm('@alice:localhost')

      // Falls back to implicit DM room after join failure
      expect(roomId).toBe('!implicit_dm:localhost')
    })
  })
})
