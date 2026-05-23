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
    getUserId: vi.fn().mockReturnValue('@me:localhost'),
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
    localStorage.clear()
    // Ensure i18n initializes with English locale when the module is first loaded.
    // Without this, the barrel file structure causes i18n to be loaded during the
    // first test (when localStorage is empty), and subsequent locale changes have
    // no effect because i18n reads locale only at module init time.
    localStorage.setItem('muon_locale', JSON.stringify('en'))
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

    await sendTextMessage(
      '!room:localhost',
      'Bold and Muon',
      '<p><strong>Bold</strong> and <a href="https://example.com">Muon</a></p>',
    )

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: 'Bold and Muon',
      format: 'org.matrix.custom.html',
      formatted_body: '<p><strong>Bold</strong> and <a href="https://example.com">Muon</a></p>',
    })
  })

  it('should keep rich-text image embeds in Matrix HTML', async () => {
    const { sendTextMessage } = await import('@/matrix/messages')

    await sendTextMessage(
      '!room:localhost',
      'Caption\n[pasted.png]',
      '<p>Caption</p><p><img src="mxc://server/media" alt="pasted.png" title="pasted.png" data-width="640" data-height="360"></p>',
    )

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: 'Caption\n[pasted.png]',
      format: 'org.matrix.custom.html',
      formatted_body:
        '<p>Caption</p><p><img src="mxc://server/media" alt="pasted.png" title="pasted.png" data-width="640" data-height="360"></p>',
    })
  })

  it('should send rich-text replies as formatted Matrix messages', async () => {
    const { replyToMessage } = await import('@/matrix/messages')

    await replyToMessage('!room:localhost', '$event1', 'quoted', '<blockquote><p>quoted</p></blockquote>')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: 'quoted',
      format: 'org.matrix.custom.html',
      formatted_body: '<blockquote><p>quoted</p></blockquote>',
      'm.relates_to': { 'm.in_reply_to': { event_id: '$event1' } },
    })
  })

  it('should include formatted rich text in message edits', async () => {
    const { editMessage } = await import('@/matrix/messages')

    await editMessage('!room:localhost', '$event1', 'code', '<p><code>code</code></p>')

    expect(mockSendMessage).toHaveBeenCalledWith('!room:localhost', {
      msgtype: 'm.text',
      body: '* code',
      format: 'org.matrix.custom.html',
      formatted_body: '<p>* <code>code</code></p>',
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
      'xyz.muon.file_hash': expect.any(String),
    })
  })

  it('should redact a message', async () => {
    const { redactMessage } = await import('@/matrix/messages')
    await redactMessage('!room:localhost', '$event1', 'spam')

    expect(mockRedactEvent).toHaveBeenCalledWith('!room:localhost', '$event1', undefined, { reason: 'spam' })
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
    let liveTimeline: { getEvents: () => unknown[]; getNeighbouringTimeline: (direction: string) => unknown }
    const olderTimeline = {
      getEvents: () => [oldEvent],
      getNeighbouringTimeline: (direction: string) => (direction === EventTimeline.FORWARDS ? liveTimeline : null),
    }
    liveTimeline = {
      getEvents: () => [newEvent],
      getNeighbouringTimeline: (direction: string) => (direction === EventTimeline.BACKWARDS ? olderTimeline : null),
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events.map((event) => event.getId())).toEqual(['$old', '$new'])
  })

  it('coalesces concurrent backward pagination for the same room timeline', async () => {
    const liveTimeline = { getEvents: () => [] }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })
    let resolvePagination!: (value: boolean) => void
    mockPaginateEventTimeline.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePagination = resolve
        }),
    )

    const { paginateBack } = await import('@/matrix/messages')
    const first = paginateBack('!room:localhost', 30)
    const second = paginateBack('!room:localhost', 30)

    expect(mockPaginateEventTimeline).toHaveBeenCalledTimes(1)
    expect(mockPaginateEventTimeline).toHaveBeenCalledWith(liveTimeline, { backwards: true, limit: 30 })

    resolvePagination(true)

    await expect(Promise.all([first, second])).resolves.toEqual([true, true])
  })

  it('starts a new backward pagination after the previous room request settles', async () => {
    const liveTimeline = { getEvents: () => [] }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })

    const { paginateBack } = await import('@/matrix/messages')
    await expect(paginateBack('!room:localhost', 30)).resolves.toBe(true)
    await expect(paginateBack('!room:localhost', 30)).resolves.toBe(true)

    expect(mockPaginateEventTimeline).toHaveBeenCalledTimes(2)
  })

  it('emits a room timeline update after backward pagination loads history', async () => {
    const liveTimeline = { getEvents: () => [] }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })

    const { matrixEvents } = await import('@/matrix/events')
    const emitSpy = vi.spyOn(matrixEvents, 'emit')
    const { paginateBack } = await import('@/matrix/messages')

    await expect(paginateBack('!room:localhost', 30)).resolves.toBe(true)

    expect(emitSpy).toHaveBeenCalledWith('room.timeline', { roomId: '!room:localhost' })
  })

  it('emits a room timeline update when backward pagination reaches the final page', async () => {
    const liveTimeline = { getEvents: () => [] }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })
    mockPaginateEventTimeline.mockResolvedValueOnce(false)

    const { matrixEvents } = await import('@/matrix/events')
    const emitSpy = vi.spyOn(matrixEvents, 'emit')
    const { paginateBack } = await import('@/matrix/messages')

    await expect(paginateBack('!room:localhost', 30)).resolves.toBe(false)

    expect(emitSpy).toHaveBeenCalledWith('room.timeline', { roomId: '!room:localhost' })
  })

  it('filters member avatar profile updates from the chat timeline', async () => {
    const avatarUpdate = {
      getId: () => '$avatar-update',
      getType: () => 'm.room.member',
      getContent: () => ({
        membership: 'join',
        displayname: 'Alice',
        avatar_url: 'mxc://localhost/alice-new',
      }),
      getPrevContent: () => ({
        membership: 'join',
        displayname: 'Alice',
        avatar_url: 'mxc://localhost/alice-old',
      }),
      isRedacted: () => false,
    }
    const messageEvent = {
      getId: () => '$message',
      getType: () => 'm.room.message',
      getContent: () => ({ msgtype: 'm.text', body: 'hello' }),
      isRedacted: () => false,
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => ({
        getEvents: () => [avatarUpdate, messageEvent],
      }),
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events.map((event) => event.getId())).toEqual(['$message'])
  })

  it('filters room avatar state events from the chat timeline', async () => {
    const roomAvatarEvent = {
      getId: () => '$room-avatar',
      getType: () => 'm.room.avatar',
      getContent: () => ({ url: 'mxc://localhost/room-avatar-new' }),
      isRedacted: () => false,
    }
    const messageEvent = {
      getId: () => '$message',
      getType: () => 'm.room.message',
      getContent: () => ({ msgtype: 'm.text', body: 'hello' }),
      isRedacted: () => false,
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => ({
        getEvents: () => [roomAvatarEvent, messageEvent],
      }),
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events.map((event) => event.getId())).toEqual(['$message'])
  })

  it('keeps membership transitions as timeline system notices', async () => {
    const joinEvent = {
      getId: () => '$join',
      getType: () => 'm.room.member',
      getContent: () => ({ membership: 'join', displayname: 'Alice' }),
      getPrevContent: () => ({ membership: 'invite', displayname: 'Alice' }),
      isRedacted: () => false,
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => ({
        getEvents: () => [joinEvent],
      }),
    })

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!room:localhost', 50)

    expect(events.map((event) => event.getId())).toEqual(['$join'])
  })

  it('localizes system event copy for the active locale', async () => {
    localStorage.setItem('muon_locale', JSON.stringify('en'))
    const joinEvent = {
      getType: () => 'm.room.member',
      getContent: () => ({ membership: 'join', displayname: 'Alice' }),
      getPrevContent: () => ({ membership: 'invite' }),
      getSender: () => '@alice:localhost',
      getStateKey: () => '@alice:localhost',
      getRoomId: () => '!room:localhost',
    }
    mockGetRoom.mockReturnValue({
      getMember: () => ({ name: 'Alice' }),
    })

    const { getSystemEventInfo } = await import('@/matrix/messages')
    const text = getSystemEventInfo(joinEvent as any)
      .parts.map((part) => part.text)
      .join('')

    expect(text).toBe('Alice joined the group chat')
  })

  it('summarizes timeline reactions and thread counts in one linked timeline pass', async () => {
    const { EventTimeline } = await import('matrix-js-sdk')
    const rootEvent = {
      getId: () => '$root',
      getType: () => 'm.room.message',
      getContent: () => ({ msgtype: 'm.text', body: 'root' }),
      getSender: () => '@alice:localhost',
      isRedacted: () => false,
    }
    const threadReply = {
      getId: () => '$reply',
      getType: () => 'm.room.message',
      getContent: () => ({
        msgtype: 'm.text',
        body: 'reply',
        'm.relates_to': { rel_type: 'm.thread', event_id: '$root' },
      }),
      getSender: () => '@bob:localhost',
      isRedacted: () => false,
    }
    const myReaction = {
      getId: () => '$reaction-1',
      getType: () => 'm.reaction',
      getContent: () => ({
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$root', key: '👍' },
      }),
      getSender: () => '@me:localhost',
      isRedacted: () => false,
    }
    const otherReaction = {
      getId: () => '$reaction-2',
      getType: () => 'm.reaction',
      getContent: () => ({
        'm.relates_to': { rel_type: 'm.annotation', event_id: '$root', key: '👍' },
      }),
      getSender: () => '@bob:localhost',
      isRedacted: () => false,
    }
    let liveTimeline: { getEvents: () => unknown[]; getNeighbouringTimeline: (direction: string) => unknown }
    const olderTimeline = {
      getEvents: () => [rootEvent],
      getNeighbouringTimeline: (direction: string) => (direction === EventTimeline.FORWARDS ? liveTimeline : null),
    }
    liveTimeline = {
      getEvents: () => [threadReply, myReaction, otherReaction],
      getNeighbouringTimeline: (direction: string) => (direction === EventTimeline.BACKWARDS ? olderTimeline : null),
    }
    mockGetRoom.mockReturnValue({
      getLiveTimeline: () => liveTimeline,
    })

    const { getTimelineRelationSummaries } = await import('@/matrix/messages')
    const summaries = getTimelineRelationSummaries('!room:localhost')

    expect(summaries.threadReplyCountsByEventId.get('$root')).toBe(1)
    expect(summaries.reactionsByEventId.get('$root')).toEqual([{ key: '👍', count: 2, myReaction: true }])
  })

  it('should return empty array for unknown room', async () => {
    mockGetRoom.mockReturnValue(null)

    const { getTimeline } = await import('@/matrix/messages')
    const events = getTimeline('!unknown:localhost')

    expect(events).toEqual([])
  })
})
