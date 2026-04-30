import { describe, expect, it, vi } from 'vitest'

const mockSendMessage = vi.fn().mockResolvedValue({ event_id: '$msg1' })
const mockRedactEvent = vi.fn().mockResolvedValue(undefined)
const mockGetRoom = vi.fn()
const mockPaginateEventTimeline = vi.fn().mockResolvedValue(true)
const mockUploadMedia = vi.fn().mockResolvedValue('mxc://server/media')
const mockExtractImageMeta = vi.fn().mockResolvedValue({ width: 640, height: 360 })

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    sendMessage: mockSendMessage,
    redactEvent: mockRedactEvent,
    getRoom: mockGetRoom,
    paginateEventTimeline: mockPaginateEventTimeline,
  })),
}))

vi.mock('@/matrix/media', () => ({
  uploadMedia: mockUploadMedia,
  extractImageMeta: mockExtractImageMeta,
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

  it('should keep raw markdown literal when the editor has not converted it', async () => {
    const { sendTextMessage } = await import('@/matrix/messages')

    await sendTextMessage('!room:localhost', '**Bold** and [Muon](https://example.com)')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: '**Bold** and [Muon](https://example.com)',
    })
  })

  it('should send editor-produced rich text as Matrix HTML', async () => {
    const { sendTextMessage } = await import('@/matrix/messages')

    await sendTextMessage('!room:localhost', 'Bold and Muon', '<p><strong>Bold</strong> and <a href="https://example.com">Muon</a></p>')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: 'Bold and Muon',
      format: 'org.matrix.custom.html',
      formatted_body: '<p><strong>Bold</strong> and <a href="https://example.com">Muon</a></p>',
    })
  })

  it('should send rich-text replies as formatted Matrix messages', async () => {
    const { replyToMessage } = await import('@/matrix/messages')

    await replyToMessage('!room:localhost', '$event1', 'quoted', '<blockquote><p>quoted</p></blockquote>')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      'msgtype': 'm.text',
      'body': 'quoted',
      'format': 'org.matrix.custom.html',
      'formatted_body': '<blockquote><p>quoted</p></blockquote>',
      'm.relates_to': { 'm.in_reply_to': { event_id: '$event1' } },
    })
  })

  it('should include formatted rich text in message edits', async () => {
    const { editMessage } = await import('@/matrix/messages')

    await editMessage('!room:localhost', '$event1', 'code', '<p><code>code</code></p>')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      'msgtype': 'm.text',
      'body': '* code',
      'format': 'org.matrix.custom.html',
      'formatted_body': '<p>* <code>code</code></p>',
      'm.new_content': {
        msgtype: 'm.text',
        body: 'code',
        format: 'org.matrix.custom.html',
        formatted_body: '<p><code>code</code></p>',
      },
      'm.relates_to': { rel_type: 'm.replace', event_id: '$event1' },
    })
  })

  it('should include image dimensions when sending image messages', async () => {
    const { sendImageMessage } = await import('@/matrix/messages')
    const file = new File(['image'], 'poster.png', { type: 'image/png' })

    await sendImageMessage('!room:localhost', file)

    expect(mockExtractImageMeta).toHaveBeenCalledWith(file)
    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.image',
      body: 'poster.png',
      url: 'mxc://server/media',
      info: {
        mimetype: 'image/png',
        size: file.size,
        w: 640,
        h: 360,
      },
    })
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

  it('should include historical events from linked earlier timelines', async () => {
    const { EventTimeline } = await import('matrix-js-sdk')
    const oldEvent = {
      getId: () => '$old',
      getType: () => 'm.room.message',
      getContent: () => ({ msgtype: 'm.text', body: 'old' }),
      isRedacted: () => false,
    }
    const newEvent = {
      getId: () => '$new',
      getType: () => 'm.room.message',
      getContent: () => ({ msgtype: 'm.text', body: 'new' }),
      isRedacted: () => false,
    }
    let liveTimeline: { getEvents: () => unknown[], getNeighbouringTimeline: (direction: string) => unknown }
    const olderTimeline = {
      getEvents: () => [oldEvent],
      getNeighbouringTimeline: (direction: string) =>
        direction === EventTimeline.FORWARDS ? liveTimeline : null,
    }
    liveTimeline = {
      getEvents: () => [newEvent],
      getNeighbouringTimeline: (direction: string) =>
        direction === EventTimeline.BACKWARDS ? olderTimeline : null,
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events.map(event => event.getId())).toEqual(['$old', '$new'])
  })

  it('should return empty array for unknown room', async () => {
    mockGetRoom.mockReturnValue(null)

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!unknown:localhost')

    expect(events).toEqual([])
  })
})
