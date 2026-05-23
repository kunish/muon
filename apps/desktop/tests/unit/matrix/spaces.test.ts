import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

// ── Helpers ──

function stateEvent(content: Record<string, any>, stateKey?: string) {
  return {
    getContent: () => content,
    getStateKey: () => stateKey ?? '',
  }
}

function stateEventWithKey(content: Record<string, any>, stateKey: string) {
  return {
    getContent: () => content,
    getStateKey: () => stateKey,
  }
}

function makeMember(userId: string, displayName: string, avatarUrl?: string) {
  return {
    userId,
    name: displayName,
    getMxcAvatarUrl: () => avatarUrl ?? null,
    membership: 'join',
    powerLevel: userId === '@test:localhost' ? 50 : 0,
  }
}

function makeRoom(overrides: Record<string, any> = {}) {
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
    getMember: vi.fn().mockReturnValue(null),
    getUnreadNotificationCount: (_type?: string) => 0,
    getLiveTimeline: () => ({ getEvents: () => [] }),
    ...overrides,
  }
}

/** Create a room that is a Space (m.room.create type = m.space) */
function makeSpaceRoom(
  roomId: string,
  name: string,
  children: Array<{ roomId: string; order?: string; isSpace?: boolean }> = [],
  extraState: Record<string, any> = {},
) {
  const childEvents = children.map((c) => stateEventWithKey({ via: ['localhost'], order: c.order }, c.roomId))

  return makeRoom({
    roomId,
    name,
    currentState: {
      getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
        if (eventType === 'm.room.create' && stateKey === '') {
          return stateEvent({ type: 'm.space' })
        }
        if (eventType === 'm.space.child' && stateKey === undefined) {
          return childEvents
        }
        if (eventType === 'm.room.topic' && stateKey === '') {
          return extraState.topic ? stateEvent({ topic: extraState.topic }) : null
        }
        if (eventType === 'm.room.power_levels' && stateKey === '') {
          return extraState.powerLevels ? stateEvent(extraState.powerLevels) : null
        }
        return null
      }),
    },
    getJoinedMemberCount: () => extraState.memberCount ?? 1,
    getMxcAvatarUrl: () => extraState.avatarUrl ?? null,
    getJoinedMembers: () => extraState.members ?? [],
  })
}

/** Create a non-space room (channel) */
function makeChannelRoom(
  roomId: string,
  name: string,
  opts: {
    isVoice?: boolean
    topic?: string
    avatarUrl?: string
    memberCount?: number
    unreadCount?: number
    highlightCount?: number
    membership?: string
    parentEvents?: boolean
  } = {},
) {
  return makeRoom({
    roomId,
    name,
    currentState: {
      getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
        if (eventType === 'im.muon.voice_channel' && stateKey === '') {
          return opts.isVoice ? stateEvent({ enabled: true }) : null
        }
        if (eventType === 'm.room.topic' && stateKey === '') {
          return opts.topic ? stateEvent({ topic: opts.topic }) : null
        }
        if (eventType === 'm.space.parent' && stateKey === undefined) {
          return opts.parentEvents ? [stateEvent({ via: ['localhost'] })] : null
        }
        return null
      }),
    },
    getJoinedMemberCount: () => opts.memberCount ?? 1,
    getMxcAvatarUrl: () => opts.avatarUrl ?? null,
    getMyMembership: () => opts.membership ?? 'join',
    getUnreadNotificationCount: (type?: string) => {
      if (type === 'total') return opts.unreadCount ?? 0
      if (type === 'highlight') return opts.highlightCount ?? 0
      return 0
    },
  })
}

// ── Tests ──

describe('matrix spaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getRoom).mockReturnValue(null)
    vi.mocked(mockClient.getRooms).mockReturnValue([])
    vi.mocked(mockClient.getDomain).mockReturnValue('localhost')
    vi.mocked(mockClient.getAccountData).mockReturnValue(null)
  })

  // ── isVoiceChannel ──

  describe('isVoiceChannel', () => {
    it('should return true when voice channel state event has enabled=true', async () => {
      const room = makeChannelRoom('!voice:localhost', 'Voice', { isVoice: true })
      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { isVoiceChannel } = await import('@/matrix/spaces')
      expect(isVoiceChannel(room as any)).toBe(true)
    })

    it('should return false when no voice channel state event exists', async () => {
      const room = makeChannelRoom('!text:localhost', 'Text Channel', { isVoice: false })

      const { isVoiceChannel } = await import('@/matrix/spaces')
      expect(isVoiceChannel(room as any)).toBe(false)
    })

    it('should return false when voice channel event content does not have enabled', async () => {
      const room = makeRoom({
        roomId: '!weird:localhost',
        currentState: {
          getStateEvents: vi.fn((eventType: string, stateKey: string) => {
            if (eventType === 'im.muon.voice_channel' && stateKey === '') {
              return stateEvent({}) // no enabled field
            }
            return null
          }),
        },
      })

      const { isVoiceChannel } = await import('@/matrix/spaces')
      expect(isVoiceChannel(room as any)).toBe(false)
    })
  })

  // ── getTopLevelSpaces ──

  describe('getTopLevelSpaces', () => {
    it('should return empty array when there are no rooms', async () => {
      vi.mocked(mockClient.getRooms).mockReturnValue([])

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      expect(getTopLevelSpaces()).toEqual([])
    })

    it('should return empty array when no rooms are spaces', async () => {
      const ch = makeChannelRoom('!ch:localhost', 'Channel')
      vi.mocked(mockClient.getRooms).mockReturnValue([ch as any])

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      expect(getTopLevelSpaces()).toEqual([])
    })

    it('should return a single top-level space', async () => {
      const server = makeSpaceRoom('!server:localhost', 'My Server', [{ roomId: '!ch1:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'general')
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(1)
      expect(spaces[0]).toMatchObject({
        spaceId: '!server:localhost',
        name: 'My Server',
        childRoomIds: ['!ch1:localhost'],
        childSpaceIds: [],
      })
    })

    it('should filter out sub-spaces (categories) from top-level results', async () => {
      // Server with a category sub-space and a channel
      const server = makeSpaceRoom('!server:localhost', 'My Server', [
        { roomId: '!category:localhost', isSpace: false }, // We mark it not as space in children listing
        { roomId: '!ch1:localhost' },
      ])
      const category = makeSpaceRoom('!category:localhost', 'Category', [])
      const ch1 = makeChannelRoom('!ch1:localhost', 'general')

      // Make the server's children include the category as a space
      vi.mocked(server.currentState.getStateEvents).mockImplementation((eventType: string, stateKey?: string) => {
        if (eventType === 'm.room.create' && stateKey === '') {
          return stateEvent({ type: 'm.space' })
        }
        if (eventType === 'm.space.child' && stateKey === undefined) {
          return [
            stateEventWithKey({ via: ['localhost'] }, '!category:localhost'),
            stateEventWithKey({ via: ['localhost'] }, '!ch1:localhost'),
          ]
        }
        return null
      })

      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, category as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!category:localhost') return category as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      // Only the server should be top-level; category is a child of server
      expect(spaces).toHaveLength(1)
      expect(spaces[0].spaceId).toBe('!server:localhost')
    })

    it('should return multiple top-level spaces', async () => {
      const server1 = makeSpaceRoom('!server1:localhost', 'Server 1', [{ roomId: '!ch1:localhost' }])
      const server2 = makeSpaceRoom('!server2:localhost', 'Server 2', [{ roomId: '!ch2:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'general')
      const ch2 = makeChannelRoom('!ch2:localhost', 'random')
      vi.mocked(mockClient.getRooms).mockReturnValue([server1 as any, server2 as any, ch1 as any, ch2 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server1:localhost') return server1 as any
        if (rid === '!server2:localhost') return server2 as any
        if (rid === '!ch1:localhost') return ch1 as any
        if (rid === '!ch2:localhost') return ch2 as any
        return null
      })

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(2)
      expect(spaces.map((s) => s.spaceId).sort()).toEqual(['!server1:localhost', '!server2:localhost'].sort())
    })

    it('should use default name "Unnamed Server" when room has no name', async () => {
      const server = makeSpaceRoom('!server:localhost', '', [])
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any])

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(1)
      expect(spaces[0].name).toBe('Unnamed Server')
    })
  })

  // ── getSpaceHierarchy ──

  describe('getSpaceHierarchy', () => {
    it('should return empty categories and channels when space has no children', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy).toEqual({ categories: [], uncategorizedChannels: [] })
    })

    it('should return uncategorized channels for a space with direct child rooms', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [
        { roomId: '!ch1:localhost', order: 'a' },
        { roomId: '!ch2:localhost', order: 'b' },
      ])
      const ch1 = makeChannelRoom('!ch1:localhost', 'General', {
        topic: 'General discussion',
        memberCount: 5,
      })
      const ch2 = makeChannelRoom('!ch2:localhost', 'Random')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        if (rid === '!ch2:localhost') return ch2 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.categories).toEqual([])
      expect(hierarchy.uncategorizedChannels).toHaveLength(2)
      expect(hierarchy.uncategorizedChannels[0]).toMatchObject({
        roomId: '!ch1:localhost',
        name: 'General',
        categoryId: null,
        order: 'a',
      })
      expect(hierarchy.uncategorizedChannels[1].roomId).toBe('!ch2:localhost')
    })

    it('should return categories with nested channels', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!cat1:localhost', order: '1' }])
      const cat1 = makeSpaceRoom('!cat1:localhost', 'Text Channels', [
        { roomId: '!ch1:localhost', order: 'a' },
        { roomId: '!ch2:localhost', order: 'b' },
      ])
      const ch1 = makeChannelRoom('!ch1:localhost', 'General')
      const ch2 = makeChannelRoom('!ch2:localhost', 'Random')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!cat1:localhost') return cat1 as any
        if (rid === '!ch1:localhost') return ch1 as any
        if (rid === '!ch2:localhost') return ch2 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.categories).toHaveLength(1)
      expect(hierarchy.categories[0]).toMatchObject({
        spaceId: '!cat1:localhost',
        name: 'Text Channels',
        childRoomIds: ['!ch1:localhost', '!ch2:localhost'],
        order: '1',
      })
      expect(hierarchy.uncategorizedChannels).toEqual([])
    })

    it('should skip non-existent child rooms', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!missing:localhost' }])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.categories).toEqual([])
      expect(hierarchy.uncategorizedChannels).toEqual([])
    })

    it('should skip child rooms where user is not joined', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!ch1:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'General', { membership: 'leave' })
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.uncategorizedChannels).toEqual([])
    })

    it('should handle mixed categories and uncategorized channels', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [
        { roomId: '!cat1:localhost', order: '1' },
        { roomId: '!orphanCh:localhost', order: '2' },
      ])
      const cat1 = makeSpaceRoom('!cat1:localhost', 'Category', [{ roomId: '!ch1:localhost' }])
      const orphanCh = makeChannelRoom('!orphanCh:localhost', 'Orphan')
      const ch1 = makeChannelRoom('!ch1:localhost', 'In Category')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!cat1:localhost') return cat1 as any
        if (rid === '!orphanCh:localhost') return orphanCh as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.categories).toHaveLength(1)
      expect(hierarchy.uncategorizedChannels).toHaveLength(1)
      expect(hierarchy.uncategorizedChannels[0].roomId).toBe('!orphanCh:localhost')
    })

    it('should use "Unnamed Category" when category space has no name', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!cat1:localhost' }])
      const cat1 = makeSpaceRoom('!cat1:localhost', '', [])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!cat1:localhost') return cat1 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      expect(hierarchy.categories[0].name).toBe('Unnamed Category')
    })
  })

  // ── buildChannelInfo ──

  describe('buildChannelInfo', () => {
    it('should build channel info for a basic text channel', async () => {
      const room = makeChannelRoom('!ch:localhost', 'General', { topic: 'Chat here' })

      const { buildChannelInfo } = await import('@/matrix/spaces')
      const info = buildChannelInfo(room as any, null, '0')

      expect(info).toMatchObject({
        roomId: '!ch:localhost',
        name: 'General',
        topic: 'Chat here',
        isVoice: false,
        categoryId: null,
        order: '0',
        unreadCount: 0,
        highlightCount: 0,
        memberCount: 1,
      })
    })

    it('should build channel info for a voice channel', async () => {
      const room = makeChannelRoom('!voice:localhost', 'Voice Chat', { isVoice: true })

      const { buildChannelInfo } = await import('@/matrix/spaces')
      const info = buildChannelInfo(room as any, '!cat:localhost')

      expect(info).toMatchObject({
        roomId: '!voice:localhost',
        name: 'Voice Chat',
        isVoice: true,
        categoryId: '!cat:localhost',
      })
    })

    it('should include unread and highlight counts', async () => {
      const room = makeChannelRoom('!busy:localhost', 'Busy', {
        unreadCount: 10,
        highlightCount: 3,
      })

      const { buildChannelInfo } = await import('@/matrix/spaces')
      const info = buildChannelInfo(room as any, null)

      expect(info.unreadCount).toBe(10)
      expect(info.highlightCount).toBe(3)
    })

    it('should use default name "unnamed" for channels without a name', async () => {
      const room = makeChannelRoom('!ch:localhost', '')

      const { buildChannelInfo } = await import('@/matrix/spaces')
      const info = buildChannelInfo(room as any, null)

      expect(info.name).toBe('unnamed')
    })

    it('should include avatar URL when available', async () => {
      const room = makeChannelRoom('!ch:localhost', 'Styled', {
        avatarUrl: 'mxc://localhost/avatar',
      })

      const { buildChannelInfo } = await import('@/matrix/spaces')
      const info = buildChannelInfo(room as any, null)

      expect(info.avatar).toBe('mxc://localhost/avatar')
    })
  })

  // ── getCategoryChannels ──

  describe('getCategoryChannels', () => {
    it('should return channels from a category space', async () => {
      const cat = makeSpaceRoom('!cat:localhost', 'Text Channels', [
        { roomId: '!ch1:localhost', order: 'a' },
        { roomId: '!ch2:localhost', order: 'b' },
      ])
      const ch1 = makeChannelRoom('!ch1:localhost', 'General')
      const ch2 = makeChannelRoom('!ch2:localhost', 'Random')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!cat:localhost') return cat as any
        if (rid === '!ch1:localhost') return ch1 as any
        if (rid === '!ch2:localhost') return ch2 as any
        return null
      })

      const { getCategoryChannels } = await import('@/matrix/spaces')
      const channels = getCategoryChannels('!cat:localhost')

      expect(channels).toHaveLength(2)
      expect(channels[0]).toMatchObject({
        roomId: '!ch1:localhost',
        categoryId: '!cat:localhost',
      })
      expect(channels[1]).toMatchObject({
        roomId: '!ch2:localhost',
        categoryId: '!cat:localhost',
      })
    })

    it('should skip sub-spaces within the category', async () => {
      const cat = makeSpaceRoom('!cat:localhost', 'Category', [
        { roomId: '!nested:localhost' },
        { roomId: '!ch1:localhost' },
      ])
      // nested is a space (sub-category) - should be skipped
      const nested = makeSpaceRoom('!nested:localhost', 'Nested Category', [])
      const ch1 = makeChannelRoom('!ch1:localhost', 'Channel')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!cat:localhost') return cat as any
        if (rid === '!nested:localhost') return nested as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getCategoryChannels } = await import('@/matrix/spaces')
      const channels = getCategoryChannels('!cat:localhost')

      expect(channels).toHaveLength(1)
      expect(channels[0].roomId).toBe('!ch1:localhost')
    })

    it('should skip non-joined rooms', async () => {
      const cat = makeSpaceRoom('!cat:localhost', 'Category', [{ roomId: '!ch1:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'Channel', { membership: 'leave' })

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!cat:localhost') return cat as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getCategoryChannels } = await import('@/matrix/spaces')
      const channels = getCategoryChannels('!cat:localhost')

      expect(channels).toEqual([])
    })

    it('should return empty array when space is not found', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null)

      const { getCategoryChannels } = await import('@/matrix/spaces')
      const channels = getCategoryChannels('!missing:localhost')

      expect(channels).toEqual([])
    })
  })

  // ── createSpace ──

  describe('createSpace', () => {
    it('should create a private space with default options', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!newspace:localhost' })

      const { createSpace } = await import('@/matrix/spaces')
      const roomId = await createSpace('My Space')

      expect(roomId).toBe('!newspace:localhost')
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: 'My Space',
        topic: undefined,
        preset: 'private_chat',
        creation_content: { type: 'm.space' },
        initial_state: [],
        power_level_content_override: {
          events_default: 0,
          invite: 50,
          kick: 50,
          ban: 50,
          redact: 50,
          state_default: 50,
        },
      })
    })

    it('should create a public space when isPublic is true', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!public:localhost' })

      const { createSpace } = await import('@/matrix/spaces')
      await createSpace('Public Space', { isPublic: true })

      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.preset).toBe('public_chat')
    })

    it('should include topic and avatar in creation', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!fancy:localhost' })

      const { createSpace } = await import('@/matrix/spaces')
      await createSpace('Fancy Space', {
        topic: 'A fancy space',
        avatar: 'mxc://localhost/fancy',
      })

      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.topic).toBe('A fancy space')
      expect(createCall.initial_state).toEqual([{ type: 'm.room.avatar', content: { url: 'mxc://localhost/fancy' } }])
    })

    it('should add child to parent when parentSpaceId is provided', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!newcat:localhost' })

      const { createSpace } = await import('@/matrix/spaces')
      const roomId = await createSpace('New Category', {
        parentSpaceId: '!server:localhost',
      })

      expect(roomId).toBe('!newcat:localhost')
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!server:localhost',
        'm.space.child',
        {
          via: ['localhost'],
          order: undefined,
          suggested: true,
        },
        '!newcat:localhost',
      )
    })
  })

  // ── addRoomToSpace ──

  describe('addRoomToSpace', () => {
    it('should add a room to a space with default options', async () => {
      const { addRoomToSpace } = await import('@/matrix/spaces')
      await addRoomToSpace('!space:localhost', '!room:localhost')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!space:localhost',
        'm.space.child',
        {
          via: ['localhost'],
          order: undefined,
          suggested: true,
        },
        '!room:localhost',
      )
    })

    it('should add a room with custom order and suggested=false', async () => {
      const { addRoomToSpace } = await import('@/matrix/spaces')
      await addRoomToSpace('!space:localhost', '!room:localhost', {
        order: 'zzz',
        suggested: false,
      })

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!space:localhost',
        'm.space.child',
        {
          via: ['localhost'],
          order: 'zzz',
          suggested: false,
        },
        '!room:localhost',
      )
    })

    it('should handle empty homeserver domain gracefully', async () => {
      vi.mocked(mockClient.getDomain).mockReturnValue(undefined as any)

      const { addRoomToSpace } = await import('@/matrix/spaces')
      // Should not throw if getDomain returns undefined/null (?? '')
      await expect(addRoomToSpace('!space:localhost', '!room:localhost')).resolves.toBeUndefined()
    })
  })

  // ── removeRoomFromSpace ──

  describe('removeRoomFromSpace', () => {
    it('should remove a room from a space by sending empty content', async () => {
      const { removeRoomFromSpace } = await import('@/matrix/spaces')
      await removeRoomFromSpace('!space:localhost', '!room:localhost')

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!space:localhost', 'm.space.child', {}, '!room:localhost')
    })
  })

  // ── getSpaceMembers ──

  describe('getSpaceMembers', () => {
    it('should return empty array when space is not found', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getSpaceMembers } = await import('@/matrix/spaces')
      const members = getSpaceMembers('!missing:localhost')

      expect(members).toEqual([])
    })

    it('should return members with default power levels', async () => {
      const members = [makeMember('@test:localhost', 'Me'), makeMember('@alice:localhost', 'Alice')]
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        members,
        memberCount: 2,
      })

      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { getSpaceMembers } = await import('@/matrix/spaces')
      const result = getSpaceMembers('!space:localhost')

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        userId: '@test:localhost',
        displayName: 'Me',
        membership: 'join',
      })
      expect(result[1].userId).toBe('@alice:localhost')
      // Default power level (no power_levels event)
      expect(result[0].powerLevel).toBe(0)
    })

    it('should return members with custom power levels', async () => {
      const members = [makeMember('@test:localhost', 'Me'), makeMember('@alice:localhost', 'Alice')]
      const powerLevels = {
        users: { '@test:localhost': 100, '@alice:localhost': 50 },
        users_default: 0,
      }
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        members,
        powerLevels,
      })

      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { getSpaceMembers } = await import('@/matrix/spaces')
      const result = getSpaceMembers('!space:localhost')

      expect(result[0].powerLevel).toBe(100)
      expect(result[1].powerLevel).toBe(50)
    })

    it('should use user default power level when user not in power_levels', async () => {
      const members = [makeMember('@test:localhost', 'Me'), makeMember('@alice:localhost', 'Alice')]
      // Only @test has explicit power level
      const powerLevels = {
        users: { '@test:localhost': 100 },
        users_default: 10,
      }
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        members,
        powerLevels,
      })

      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { getSpaceMembers } = await import('@/matrix/spaces')
      const result = getSpaceMembers('!space:localhost')

      expect(result[0].powerLevel).toBe(100)
      expect(result[1].powerLevel).toBe(10)
    })

    it('should derive display name from userId when name is missing', async () => {
      const member = {
        userId: '@test:localhost',
        name: '', // no displayName
        getMxcAvatarUrl: () => null,
        membership: 'join',
      }
      const room = makeRoom({
        roomId: '!space:localhost',
        currentState: {
          getStateEvents: vi.fn((eventType: string, stateKey: string) => {
            if (eventType === 'm.room.power_levels' && stateKey === '') {
              return stateEvent({ users_default: 0 })
            }
            return null
          }),
        },
        getJoinedMembers: () => [member],
      })

      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { getSpaceMembers } = await import('@/matrix/spaces')
      const result = getSpaceMembers('!space:localhost')

      expect(result[0].displayName).toBe('test')
    })
  })

  // ── setSpacePowerLevel ──

  describe('setSpacePowerLevel', () => {
    it('should throw an error when space is not found', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { setSpacePowerLevel } = await import('@/matrix/spaces')
      await expect(setSpacePowerLevel('!missing:localhost', '@alice:localhost', 50)).rejects.toThrow(
        'Space !missing:localhost not found',
      )
    })

    it('should set a user power level when no previous power levels exist', async () => {
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        powerLevels: undefined, // No power_levels event
      })
      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { setSpacePowerLevel } = await import('@/matrix/spaces')
      await setSpacePowerLevel('!space:localhost', '@alice:localhost', 50)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!space:localhost', 'm.room.power_levels', {
        users: { '@alice:localhost': 50 },
      })
    })

    it('should preserve existing power levels when adding a new user', async () => {
      const existingPowerLevels = {
        users: { '@bob:localhost': 100 },
        users_default: 0,
      }
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        powerLevels: existingPowerLevels,
      })
      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { setSpacePowerLevel } = await import('@/matrix/spaces')
      await setSpacePowerLevel('!space:localhost', '@alice:localhost', 50)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!space:localhost', 'm.room.power_levels', {
        users: { '@bob:localhost': 100, '@alice:localhost': 50 },
        users_default: 0,
      })
    })

    it('should override existing user power level', async () => {
      const existingPowerLevels = {
        users: { '@alice:localhost': 10 },
      }
      const room = makeSpaceRoom('!space:localhost', 'Server', [], {
        powerLevels: existingPowerLevels,
      })
      vi.mocked(mockClient.getRoom).mockReturnValue(room as any)

      const { setSpacePowerLevel } = await import('@/matrix/spaces')
      await setSpacePowerLevel('!space:localhost', '@alice:localhost', 99)

      expect(mockClient.sendStateEvent).toHaveBeenCalledWith('!space:localhost', 'm.room.power_levels', {
        users: { '@alice:localhost': 99 },
      })
    })
  })

  // ── createChannel ──

  describe('createChannel', () => {
    it('should create a basic channel and add to space', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!newch:localhost' })

      const { createChannel } = await import('@/matrix/spaces')
      const roomId = await createChannel('!space:localhost', 'General')

      expect(roomId).toBe('!newch:localhost')
      expect(mockClient.createRoom).toHaveBeenCalledWith({
        name: 'General',
        topic: undefined,
        preset: 'public_chat',
        initial_state: [
          {
            type: 'm.space.parent',
            content: { via: ['localhost'], canonical: true },
            state_key: '!space:localhost',
          },
        ],
      })
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!space:localhost',
        'm.space.child',
        {
          via: ['localhost'],
          order: undefined,
          suggested: true,
        },
        '!newch:localhost',
      )
    })

    it('should create a voice channel with voice state event', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!voicech:localhost' })

      const { createChannel } = await import('@/matrix/spaces')
      await createChannel('!space:localhost', 'Voice Zone', { isVoice: true })

      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.initial_state).toContainEqual({
        type: 'im.muon.voice_channel',
        content: { enabled: true },
        state_key: '',
      })
    })

    it('should create a private channel', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!privatech:localhost' })

      const { createChannel } = await import('@/matrix/spaces')
      await createChannel('!space:localhost', 'Private', { isPrivate: true })

      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.preset).toBe('private_chat')
    })

    it('should add channel to category when categoryId is provided', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!catch:localhost' })

      const { createChannel } = await import('@/matrix/spaces')
      await createChannel('!space:localhost', 'Cat Channel', {
        categoryId: '!cat:localhost',
      })

      // Parent should be the category, not the space
      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.initial_state).toContainEqual({
        type: 'm.space.parent',
        content: { via: ['localhost'], canonical: true },
        state_key: '!cat:localhost',
      })

      // sendStateEvent should add to category
      expect(mockClient.sendStateEvent).toHaveBeenCalledWith(
        '!cat:localhost',
        'm.space.child',
        expect.any(Object),
        '!catch:localhost',
      )
    })

    it('should set topic on channel creation', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!topicch:localhost' })

      const { createChannel } = await import('@/matrix/spaces')
      await createChannel('!space:localhost', 'Announcements', {
        topic: 'Important updates only',
      })

      const createCall = vi.mocked(mockClient.createRoom).mock.calls[0][0]
      expect(createCall.topic).toBe('Important updates only')
    })

    it('should handle empty homeserver domain gracefully', async () => {
      vi.mocked(mockClient.createRoom).mockResolvedValue({ room_id: '!newch:localhost' })
      vi.mocked(mockClient.getDomain).mockReturnValue(undefined as any)

      const { createChannel } = await import('@/matrix/spaces')
      // Should not throw when getDomain returns undefined
      await expect(createChannel('!space:localhost', 'General')).resolves.toBe('!newch:localhost')
    })
  })

  // ── getOrphanRooms ──

  describe('getOrphanRooms', () => {
    it('should return empty array when all rooms are space-managed', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!ch1:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'General')
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toEqual([])
    })

    it('should return rooms that are not children of any space and not DMs', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [
        // Empty - no children
      ])
      const orphan = makeChannelRoom('!orphan:localhost', 'Lonely Room')
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, orphan as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!orphan:localhost') return orphan as any
        return null
      })
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should exclude DM rooms from orphans', async () => {
      // DM room in m.direct
      const dmRoom = makeChannelRoom('!dm_alice:localhost', 'Alice')
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([dmRoom as any, orphan as any])
      vi.mocked(mockClient.getRoom).mockReturnValue(null)
      // Set up account data so !dm_alice:localhost is recognized as a DM
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({ '@alice:localhost': ['!dm_alice:localhost'] }),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      // DM rooms should be excluded
      expect(orphans.find((o) => o.roomId === '!dm_alice:localhost')).toBeUndefined()
      // Orphan should still be there
      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should exclude space rooms from orphans', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [])
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, orphan as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!orphan:localhost') return orphan as any
        return null
      })
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should exclude rooms with m.space.parent events', async () => {
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      const managed = makeChannelRoom('!managed:localhost', 'Managed', {
        parentEvents: true,
      })
      vi.mocked(mockClient.getRooms).mockReturnValue([orphan as any, managed as any])
      vi.mocked(mockClient.getRoom).mockReturnValue(null)
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should handle null account data for m.direct', async () => {
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([orphan as any])
      vi.mocked(mockClient.getRoom).mockReturnValue(null)
      // getAccountData returns null for m.direct -> should not crash
      vi.mocked(mockClient.getAccountData).mockReturnValue(null as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should handle account data with no content (empty direct event)', async () => {
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([orphan as any])
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
    })

    it('should handle DM content with non-array values gracefully', async () => {
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([orphan as any])
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        // Non-array value in DM content - the Array.isArray guard should handle this
        getContent: () => ({ '@alice:localhost': 'not_an_array' }),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      // Non-array values are simply skipped, so the orphan room is still returned
      expect(orphans).toHaveLength(1)
    })

    it('should only include joined rooms', async () => {
      const leftRoom = makeChannelRoom('!left:localhost', 'Left', { membership: 'leave' })
      const orphan = makeChannelRoom('!orphan:localhost', 'Orphan')
      vi.mocked(mockClient.getRooms).mockReturnValue([leftRoom as any, orphan as any])
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toHaveLength(1)
      expect(orphans[0].roomId).toBe('!orphan:localhost')
    })

    it('should handle multiple spaces managing the same room (dedup)', async () => {
      const server1 = makeSpaceRoom('!server1:localhost', 'Server 1', [{ roomId: '!shared:localhost' }])
      const server2 = makeSpaceRoom('!server2:localhost', 'Server 2', [{ roomId: '!shared:localhost' }])
      const shared = makeChannelRoom('!shared:localhost', 'Shared')
      vi.mocked(mockClient.getRooms).mockReturnValue([server1 as any, server2 as any, shared as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server1:localhost') return server1 as any
        if (rid === '!server2:localhost') return server2 as any
        if (rid === '!shared:localhost') return shared as any
        return null
      })
      vi.mocked(mockClient.getAccountData).mockReturnValue({
        getContent: () => ({}),
      } as any)

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      // Shared room is managed by both spaces, so not an orphan
      expect(orphans).toEqual([])
    })

    it('should return no rooms when all are spaces, DMs, or managed', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [{ roomId: '!ch1:localhost' }])
      const ch1 = makeChannelRoom('!ch1:localhost', 'Managed')
      // DM rooms - the default account data includes them
      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getOrphanRooms } = await import('@/matrix/spaces')
      const orphans = getOrphanRooms()

      expect(orphans).toEqual([])
    })
  })

  // ── getSpaceChildren (internal, tested via exported functions) ──

  describe('space children traversal', () => {
    it('should filter out child events with empty content (removed children)', async () => {
      // getSpaceChildren filters events where content is empty
      const server = makeRoom({
        roomId: '!server:localhost',
        name: 'Server',
        currentState: {
          getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
            if (eventType === 'm.room.create' && stateKey === '') {
              return stateEvent({ type: 'm.space' })
            }
            if (eventType === 'm.space.child' && stateKey === undefined) {
              return [
                // Valid child
                stateEventWithKey({ via: ['localhost'] }, '!ch1:localhost'),
                // Empty content child (removed) - should be filtered
                stateEventWithKey({}, '!removed:localhost'),
              ]
            }
            return null
          }),
        },
      })
      const ch1 = makeChannelRoom('!ch1:localhost', 'General')

      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(1)
      // Only the valid child should appear, not the removed one
      expect(spaces[0].childRoomIds).toEqual(['!ch1:localhost'])
    })

    it('should filter out child events without via field (invalid children)', async () => {
      const server = makeRoom({
        roomId: '!server:localhost',
        name: 'Server',
        currentState: {
          getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
            if (eventType === 'm.room.create' && stateKey === '') {
              return stateEvent({ type: 'm.space' })
            }
            if (eventType === 'm.space.child' && stateKey === undefined) {
              return [
                // Child with via
                stateEventWithKey({ via: ['localhost'] }, '!ch1:localhost'),
                // Child without via (invalid) - should be filtered
                stateEventWithKey({ order: '1' }, '!invalid:localhost'),
              ]
            }
            return null
          }),
        },
      })
      const ch1 = makeChannelRoom('!ch1:localhost', 'General')

      vi.mocked(mockClient.getRooms).mockReturnValue([server as any, ch1 as any])
      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        return null
      })

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(1)
      expect(spaces[0].childRoomIds).toEqual(['!ch1:localhost'])
    })

    it('should return empty array when getStateEvents returns non-array for space children', async () => {
      const server = makeRoom({
        roomId: '!server:localhost',
        name: 'Server',
        currentState: {
          getStateEvents: vi.fn((eventType: string, stateKey?: string) => {
            if (eventType === 'm.room.create' && stateKey === '') {
              return stateEvent({ type: 'm.space' })
            }
            if (eventType === 'm.space.child' && stateKey === undefined) {
              return null // null instead of array
            }
            return null
          }),
        },
      })

      vi.mocked(mockClient.getRooms).mockReturnValue([server as any])
      vi.mocked(mockClient.getRoom).mockReturnValue(server as any)

      const { getTopLevelSpaces } = await import('@/matrix/spaces')
      const spaces = getTopLevelSpaces()

      expect(spaces).toHaveLength(1)
      expect(spaces[0].childRoomIds).toEqual([])
      expect(spaces[0].childSpaceIds).toEqual([])
    })

    it('should sort children by order', async () => {
      const server = makeSpaceRoom('!server:localhost', 'Server', [
        { roomId: '!ch3:localhost', order: 'c' },
        { roomId: '!ch1:localhost', order: 'a' },
        { roomId: '!ch2:localhost', order: 'b' },
      ])
      const ch1 = makeChannelRoom('!ch1:localhost', 'First')
      const ch2 = makeChannelRoom('!ch2:localhost', 'Second')
      const ch3 = makeChannelRoom('!ch3:localhost', 'Third')

      vi.mocked(mockClient.getRoom).mockImplementation((rid: string) => {
        if (rid === '!server:localhost') return server as any
        if (rid === '!ch1:localhost') return ch1 as any
        if (rid === '!ch2:localhost') return ch2 as any
        if (rid === '!ch3:localhost') return ch3 as any
        return null
      })

      const { getSpaceHierarchy } = await import('@/matrix/spaces')
      const hierarchy = getSpaceHierarchy('!server:localhost')

      const channelRoomIds = hierarchy.uncategorizedChannels.map((c) => c.roomId)
      expect(channelRoomIds).toEqual(['!ch1:localhost', '!ch2:localhost', '!ch3:localhost'])
    })
  })
})
