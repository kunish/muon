import type { DigestSourceEvent } from '@/features/chat/types/digest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  digestStore,
  ingestEvent,
  resetDigestStore,
  setFilter,
  startRuntimeSync,
  stopRuntimeSync,
} from '@/features/chat/stores/digestStore'

type MatrixMessageHandler = (payload: { roomId: string; event: any }) => void

const matrixOnMock = vi.fn()
const matrixOffMock = vi.fn()
const runtimeHandlers = new Map<string, MatrixMessageHandler>()

vi.mock('@/matrix/events', () => ({
  matrixEvents: {
    on: (eventName: string, handler: MatrixMessageHandler) => {
      matrixOnMock(eventName, handler)
      runtimeHandlers.set(eventName, handler)
    },
    off: (eventName: string, handler: MatrixMessageHandler) => {
      matrixOffMock(eventName, handler)
      runtimeHandlers.delete(eventName)
    },
  },
}))

function sourceEvent(overrides: Partial<DigestSourceEvent> = {}): DigestSourceEvent {
  return {
    roomId: '!room:muon.dev',
    eventId: '$event-1',
    sender: '@alice:muon.dev',
    body: 'Body',
    ts: 150,
    ...overrides,
  }
}

describe('digestStore (client runtime + filter)', () => {
  beforeEach(() => {
    resetDigestStore()
    matrixOnMock.mockReset()
    matrixOffMock.mockReset()
    runtimeHandlers.clear()
  })

  it('starts with no source events and the all filter', () => {
    expect(digestStore.state.sourceEvents).toEqual([])
    expect(digestStore.state.activeFilter).toBe('all')
  })

  it('ingestEvent appends new events and dedupes by eventId', () => {
    ingestEvent(sourceEvent({ eventId: '$a', body: 'first' }))
    ingestEvent(sourceEvent({ eventId: '$b', body: 'second' }))
    expect(digestStore.state.sourceEvents.map((event) => event.eventId)).toEqual(['$a', '$b'])

    ingestEvent(sourceEvent({ eventId: '$a', body: 'updated' }))
    expect(digestStore.state.sourceEvents).toHaveLength(2)
    expect(digestStore.state.sourceEvents.find((event) => event.eventId === '$a')?.body).toBe('updated')
  })

  it('setFilter updates the active filter', () => {
    setFilter('responsibility')
    expect(digestStore.state.activeFilter).toBe('responsibility')
  })

  it('startRuntimeSync subscribes and ingests valid room.message events', () => {
    startRuntimeSync()

    expect(matrixOnMock).toHaveBeenCalledWith('room.message', expect.any(Function))
    const handler = runtimeHandlers.get('room.message')
    expect(handler).toBeTypeOf('function')

    handler?.({
      roomId: '!ops:muon.dev',
      event: {
        getId: () => '$runtime-event',
        getTs: () => 170,
        getSender: () => '@alice:muon.dev',
        getContent: () => ({ body: 'Follow-up needed' }),
      },
    })

    expect(digestStore.state.sourceEvents).toHaveLength(1)
    expect(digestStore.state.sourceEvents[0]).toMatchObject({
      roomId: '!ops:muon.dev',
      eventId: '$runtime-event',
      body: 'Follow-up needed',
    })
  })

  it('ignores runtime events missing an id, sender, timestamp, or body', () => {
    startRuntimeSync()
    const handler = runtimeHandlers.get('room.message')!

    handler({
      roomId: '!ops:muon.dev',
      event: {
        getId: () => '$no-body',
        getTs: () => 170,
        getSender: () => '@alice:muon.dev',
        getContent: () => ({ body: '' }),
      },
    })
    handler({
      roomId: '!ops:muon.dev',
      event: {
        getId: () => undefined,
        getTs: () => 170,
        getSender: () => '@alice:muon.dev',
        getContent: () => ({ body: 'No id' }),
      },
    })

    expect(digestStore.state.sourceEvents).toHaveLength(0)
  })

  it('startRuntimeSync is idempotent — a second call does not double-subscribe', () => {
    startRuntimeSync()
    startRuntimeSync()
    expect(matrixOnMock).toHaveBeenCalledTimes(1)
  })

  it('stopRuntimeSync unsubscribes the active handler', () => {
    startRuntimeSync()
    const handler = runtimeHandlers.get('room.message')

    stopRuntimeSync()

    expect(matrixOffMock).toHaveBeenCalledWith('room.message', handler)
    expect(runtimeHandlers.has('room.message')).toBe(false)
  })

  it('resetDigestStore clears state and stops the runtime sync', () => {
    ingestEvent(sourceEvent())
    setFilter('follow')
    startRuntimeSync()

    resetDigestStore()

    expect(digestStore.state.sourceEvents).toEqual([])
    expect(digestStore.state.activeFilter).toBe('all')
    expect(matrixOffMock).toHaveBeenCalledWith('room.message', expect.any(Function))
  })
})
