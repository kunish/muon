import { describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.fn().mockResolvedValue({ event_id: '$msg1' })
const mockRedactEvent = vi.fn().mockResolvedValue(undefined)
const mockGetRoom = vi.fn()
const mockPaginateEventTimeline = vi.fn().mockResolvedValue(true)

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    sendMessage: mockSendMessage,
    redactEvent: mockRedactEvent,
    getRoom: mockGetRoom,
    paginateEventTimeline: mockPaginateEventTimeline,
  })),
}))

describe('messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should send a text message', async () => {
    const { sendTextMessage } = await import('@/matrix/messages')
    const eventId = await sendTextMessage('!room:localhost', 'Hello')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: 'Hello',
    })
    expect(eventId).toBe('$msg1')
  })

  it('should redact a message', async () => {
    const { redactMessage } = await import('@/matrix/messages')
    await redactMessage('!room:localhost', '$event1', 'spam')

    expect(mockRedactEvent).toHaveBeenCalledWith(
      '!room:localhost',
      '$event1',
      undefined,
      { reason: 'spam' },
    )
  })

  it('should get timeline events', async () => {
    const mockEvents = [
      {
        getId: () => '$e1',
        getType: () => 'm.room.message',
        getContent: () => ({ msgtype: 'm.text', body: 'hello' }),
        isRedacted: () => false,
      },
      {
        getId: () => '$e2',
        getType: () => 'm.room.message',
        getContent: () => ({ msgtype: 'm.text', body: 'world' }),
        isRedacted: () => false,
      },
    ]
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => ({
        getEvents: () => mockEvents,
      }),
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events).toHaveLength(2)
  })

  it('should return empty array for unknown room', async () => {
    mockGetRoom.mockReturnValue(null)

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!unknown:localhost')

    expect(events).toEqual([])
  })
})
