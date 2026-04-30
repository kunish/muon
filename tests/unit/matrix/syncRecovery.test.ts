import { EventTimeline } from 'matrix-js-sdk'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixEvents } from '@/matrix/events'
import { getRoomSummaries, invalidateRoomSummariesCache } from '@/matrix/rooms'
import { startSync, stopSync, syncState } from '@/matrix/sync'
import { mockClient } from '../../mocks/matrix'
import { createMatrixEvent, createRecoveryRoom } from '../../mocks/recovery'

describe('matrix sync recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    invalidateRoomSummariesCache()
    syncState.value = 'STOPPED'
  })

  it('models reconnect and catch-up states and emits recovery lifecycle events', () => {
    let syncListener: ((state: string) => void) | undefined

    vi.mocked(mockClient.on).mockImplementation((event: any, callback: any) => {
      if (event === 'sync')
        syncListener = callback
    })

    const emitSpy = vi.spyOn(matrixEvents, 'emit')

    startSync()

    syncListener?.('RECONNECTING')
    expect(syncState.value as string).toBe('RECONNECTING')
    expect(emitSpy).toHaveBeenCalledWith('sync.state', { state: 'RECONNECTING' })

    syncListener?.('CATCHUP')
    expect(syncState.value as string).toBe('CATCHUP')
    expect(emitSpy).toHaveBeenCalledWith('sync.state', { state: 'CATCHUP' })

    syncListener?.('PREPARED')
    expect(syncState.value).toBe('PREPARED')
    expect(emitSpy).toHaveBeenCalledWith('sync.state', { state: 'PREPARED' })

    syncListener?.('SYNCING')
    expect(syncState.value).toBe('SYNCING')
    expect(emitSpy).toHaveBeenCalledWith('sync.state', { state: 'SYNCING' })

    stopSync()
  })

  it('derives limited-timeline room summaries from the live timeline instead of stale timeline data', () => {
    const room = createRecoveryRoom({
      roomId: '!limited:localhost',
      name: 'Limited Timeline Room',
      timelineEvents: [createMatrixEvent({ eventId: '$stale', ts: 100, body: 'stale summary body' })],
      liveTimelineEvents: [createMatrixEvent({ eventId: '$live', ts: 900, body: 'latest visible recovery body' })],
      unreadCount: 1,
    })

    vi.mocked(mockClient.getRooms).mockReturnValue([room])

    const summaries = getRoomSummaries()

    expect(summaries).toHaveLength(1)
    expect(summaries[0]).toMatchObject({
      roomId: room.roomId,
      lastMessage: 'latest visible recovery body',
      lastMessageTs: 900,
    })
  })

  it('marks undecrypted latest encrypted events as the latest summary type', () => {
    const room = createRecoveryRoom({
      roomId: '!encrypted:localhost',
      name: 'Encrypted Room',
      liveTimelineEvents: [
        {
          getId: () => '$encrypted',
          getTs: () => 1200,
          getType: () => 'm.room.encrypted',
          getSender: () => '@alice:example.com',
          getContent: () => ({}),
        },
      ],
      unreadCount: 1,
    })

    vi.mocked(mockClient.getRooms).mockReturnValue([room])

    const summaries = getRoomSummaries()

    expect(summaries[0]).toMatchObject({
      roomId: room.roomId,
      lastMessage: undefined,
      lastMessageTs: 1200,
      lastMessageType: 'm.room.encrypted',
    })
  })

  it('derives room summaries from linked earlier timelines when live timeline has no visible messages', () => {
    const historicalMessage = createMatrixEvent({
      eventId: '$linked-history',
      ts: 900,
      body: 'linked timeline body',
    })
    const liveMembershipEvent = createMatrixEvent({
      eventId: '$member-only',
      ts: 1200,
      type: 'm.room.member',
      body: 'membership change',
    })

    let liveTimeline: {
      getEvents: () => unknown[]
      getNeighbouringTimeline: (direction: string) => unknown
    }
    const earlierTimeline = {
      getEvents: () => [historicalMessage],
      getNeighbouringTimeline: (direction: string) =>
        direction === EventTimeline.FORWARDS ? liveTimeline : null,
    }
    liveTimeline = {
      getEvents: () => [liveMembershipEvent],
      getNeighbouringTimeline: (direction: string) =>
        direction === EventTimeline.BACKWARDS ? earlierTimeline : null,
    }

    const room = {
      ...createRecoveryRoom({
        roomId: '!linked:localhost',
        name: 'Linked Timeline Room',
        liveTimelineEvents: [],
        timelineEvents: [],
        unreadCount: 1,
      }),
      getLiveTimeline: vi.fn(() => liveTimeline),
    }

    vi.mocked(mockClient.getRooms).mockReturnValue([room])

    const summaries = getRoomSummaries()

    expect(summaries[0]).toMatchObject({
      roomId: room.roomId,
      lastMessage: 'linked timeline body',
      lastMessageTs: 900,
      lastMessageType: 'm.text',
    })
  })
})
