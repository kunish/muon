import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

describe('matrix receipts', () => {
  const mockRoom = {
    findEventById: vi.fn(),
    getAccountData: vi.fn(),
    getEventReadUpTo: vi.fn(),
    getJoinedMembers: vi.fn(),
    getLiveTimeline: vi.fn(),
  }
  const mockEvent = { getId: () => '$event:localhost' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getRoom).mockReturnValue(mockRoom as any)
    vi.mocked(mockClient.getUserId).mockReturnValue('@test:localhost')
    mockRoom.findEventById.mockReturnValue(null)
    mockRoom.getAccountData.mockReturnValue(null)
    mockRoom.getEventReadUpTo.mockReturnValue(null)
    mockRoom.getJoinedMembers.mockReturnValue([])
  })

  describe('sendReadReceipt', () => {
    it('should send a read receipt when the event exists in the room', async () => {
      mockRoom.findEventById.mockReturnValue(mockEvent)

      const { sendReadReceipt } = await import('@/matrix/receipts')
      await sendReadReceipt('!room:localhost', '$event:localhost')

      expect(mockClient.getRoom).toHaveBeenCalledWith('!room:localhost')
      expect(mockRoom.findEventById).toHaveBeenCalledWith('$event:localhost')
      expect(mockClient.sendReadReceipt).toHaveBeenCalledWith(mockEvent)
    })

    it('should not send a receipt when the room does not exist', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { sendReadReceipt } = await import('@/matrix/receipts')
      await sendReadReceipt('!nonexistent:localhost', '$event:localhost')

      expect(mockClient.sendReadReceipt).not.toHaveBeenCalled()
    })

    it('should not send a receipt when the event is not found', async () => {
      mockRoom.findEventById.mockReturnValue(null)
      vi.mocked(mockClient.sendReadReceipt).mockClear()

      const { sendReadReceipt } = await import('@/matrix/receipts')
      await sendReadReceipt('!room:localhost', '$missing:localhost')

      expect(mockClient.sendReadReceipt).not.toHaveBeenCalled()
    })
  })

  describe('getReadMarkerEventId', () => {
    it('should return the m.fully_read event_id when available', async () => {
      mockRoom.getAccountData.mockReturnValue({
        getContent: () => ({ event_id: '$read_event:localhost' }),
      })

      const { getReadMarkerEventId } = await import('@/matrix/receipts')
      const eventId = getReadMarkerEventId('!room:localhost')

      expect(eventId).toBe('$read_event:localhost')
    })

    it('should fall back to per-user read receipt when no m.fully_read', async () => {
      mockRoom.getAccountData.mockReturnValue(null)
      mockRoom.getEventReadUpTo.mockReturnValue('$receipt_event:localhost')

      const { getReadMarkerEventId } = await import('@/matrix/receipts')
      const eventId = getReadMarkerEventId('!room:localhost')

      expect(eventId).toBe('$receipt_event:localhost')
    })

    it('should return null when room does not exist', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getReadMarkerEventId } = await import('@/matrix/receipts')
      const eventId = getReadMarkerEventId('!nonexistent:localhost')

      expect(eventId).toBeNull()
    })

    it('should return null when fully_read has no event_id', async () => {
      mockRoom.getAccountData.mockReturnValue({
        getContent: () => ({}),
      })

      const { getReadMarkerEventId } = await import('@/matrix/receipts')
      const eventId = getReadMarkerEventId('!room:localhost')

      expect(eventId).toBeNull()
    })

    it('should return null when userId is not available and no receipt', async () => {
      vi.mocked(mockClient.getUserId).mockReturnValue(null)
      mockRoom.getAccountData.mockReturnValue(null)
      mockRoom.getEventReadUpTo.mockReturnValue(null)

      const { getReadMarkerEventId } = await import('@/matrix/receipts')
      const eventId = getReadMarkerEventId('!room:localhost')

      expect(eventId).toBeNull()
    })
  })

  describe('getReadUsers', () => {
    function makeTimeline(ids: string[]) {
      return {
        getEvents: () => ids.map((id) => ({ getId: () => id })),
      }
    }

    it('should return users who have read up to or past the target event', async () => {
      mockRoom.getJoinedMembers.mockReturnValue([
        { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
        { userId: '@alice:localhost', name: 'Alice', getMxcAvatarUrl: () => 'mxc://localhost/alice' },
        { userId: '@bob:localhost', name: 'Bob', getMxcAvatarUrl: () => null },
      ])
      mockRoom.getLiveTimeline.mockReturnValue(makeTimeline(['$evt1', '$evt2', '$evt3']))
      mockRoom.getEventReadUpTo.mockImplementation((userId: string) => {
        if (userId === '@alice:localhost') return '$evt2'
        if (userId === '@bob:localhost') return '$evt3'
        return null
      })

      const { getReadUsers } = await import('@/matrix/receipts')
      const users = getReadUsers('!room:localhost', '$evt2')

      expect(users).toHaveLength(2)
      expect(users.map((u) => u.userId)).toContain('@alice:localhost')
      expect(users.map((u) => u.userId)).toContain('@bob:localhost')
    })

    it('should exclude the current user from read users list', async () => {
      mockRoom.getJoinedMembers.mockReturnValue([
        { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
      ])
      mockRoom.getLiveTimeline.mockReturnValue(makeTimeline(['$evt1']))
      mockRoom.getEventReadUpTo.mockReturnValue('$evt1')

      const { getReadUsers } = await import('@/matrix/receipts')
      const users = getReadUsers('!room:localhost', '$evt1')

      expect(users).toHaveLength(0)
    })

    it('should return empty array when room does not exist', async () => {
      vi.mocked(mockClient.getRoom).mockReturnValue(null as any)

      const { getReadUsers } = await import('@/matrix/receipts')
      const users = getReadUsers('!nonexistent:localhost', '$evt1')

      expect(users).toEqual([])
    })

    it('should handle users with no display name by falling back to userId', async () => {
      mockRoom.getJoinedMembers.mockReturnValue([
        { userId: '@test:localhost', name: 'Me', getMxcAvatarUrl: () => null },
        { userId: '@alice:localhost', name: undefined, getMxcAvatarUrl: () => null },
      ])
      mockRoom.getLiveTimeline.mockReturnValue(makeTimeline(['$evt1', '$evt2']))
      mockRoom.getEventReadUpTo.mockImplementation((userId: string) => {
        if (userId === '@alice:localhost') return '$evt2'
        return null
      })

      const { getReadUsers } = await import('@/matrix/receipts')
      const users = getReadUsers('!room:localhost', '$evt1')

      expect(users).toHaveLength(1)
      expect(users[0].name).toBe('alice')
    })
  })
})
