import { beforeEach, describe, expect, it, vi } from 'vitest'
import { matrixEvents } from '@/matrix/events'
import { getRoomSummaries } from '@/matrix/rooms'
import { startSync, stopSync, syncState } from '@/matrix/sync'
import { mockClient } from '../../mocks/matrix'
import { createMatrixEvent, createRecoveryRoom } from '../../mocks/recovery'

describe('matrix sync recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
})
