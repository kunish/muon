import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveDigestEntryMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const matrixOnMock = vi.fn()
const matrixOffMock = vi.fn()
const getRoomSummariesMock = vi.fn()
const getUserIdMock = vi.fn()

type MatrixMessageHandler = (payload: { roomId: string, event: any }) => void

const runtimeHandlers = new Map<string, MatrixMessageHandler>()

vi.mock('@/shared/composables/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    status: { value: 'online' },
    lastOfflineAt: { value: 100 },
  }),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDigestEntry: (...args: unknown[]) => saveDigestEntryMock(...args),
  }),
}))

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

vi.mock('@/matrix/rooms', () => ({
  getRoomSummaries: () => getRoomSummariesMock(),
}))

vi.mock('@/matrix/client', () => ({
  getClient: () => ({
    getUserId: () => getUserIdMock(),
  }),
}))

describe('digestStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    runtimeHandlers.clear()
    saveDigestEntryMock.mockReset()
    listDigestEntriesMock.mockReset()
    matrixOnMock.mockReset()
    matrixOffMock.mockReset()
    getRoomSummariesMock.mockReset()
    getUserIdMock.mockReset()

    saveDigestEntryMock.mockResolvedValue(undefined)
    listDigestEntriesMock.mockResolvedValue([])
    getRoomSummariesMock.mockReturnValue([])
    getUserIdMock.mockReturnValue('@me:muon.dev')
  })

  it('hydrates saved digest entries before refreshing the current away-window session', async () => {
    const callSequence: string[] = []
    listDigestEntriesMock.mockImplementation(async () => {
      callSequence.push('list')
      return [
        {
          id: 'digest:$saved',
          sessionId: 'digest-session:historic',
          title: 'Saved digest',
          summary: 'Saved digest summary',
          relevance: 'mention',
          citations: [{ roomId: '!saved:muon.dev', eventId: '$saved', quote: 'Saved digest summary' }],
          citationEventIds: ['$saved'],
          createdAt: 90,
          updatedAt: 90,
        },
      ]
    })
    saveDigestEntryMock.mockImplementation(async () => {
      callSequence.push('save')
    })

    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$inside-window',
      sender: '@alice:muon.dev',
      body: 'Current digest summary',
      ts: 150,
    })

    await store.initializeDigest({ now: 200 })

    expect(listDigestEntriesMock).toHaveBeenCalledTimes(1)
    expect(callSequence[0]).toBe('list')
    expect(store.visibleEntries.map(entry => entry.eventId)).toEqual(['$inside-window'])
    expect(saveDigestEntryMock).toHaveBeenCalledTimes(1)
  })

  it('subscribes to room.message runtime events and ingests real Matrix messages', async () => {
    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    await store.initializeDigest({ now: 200 })

    const handler = runtimeHandlers.get('room.message')
    expect(matrixOnMock).toHaveBeenCalledWith('room.message', expect.any(Function))
    expect(handler).toBeTypeOf('function')

    handler?.({
      roomId: '!ops:muon.dev',
      event: {
        getId: () => '$runtime-event',
        getTs: () => 170,
        getSender: () => '@alice:muon.dev',
        getContent: () => ({ body: 'Follow-up needed from @me:muon.dev' }),
      },
    })

    expect(store.sourceEvents).toHaveLength(1)
    expect(store.sourceEvents[0]).toMatchObject({
      roomId: '!ops:muon.dev',
      eventId: '$runtime-event',
      body: 'Follow-up needed from @me:muon.dev',
    })

    store.stopRuntimeSync()
    expect(matrixOffMock).toHaveBeenCalledWith('room.message', handler)
  })

  it('initializeDigest preserves hydrated entries when sourceEvents is empty and lastOfflineAt is set', async () => {
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest:$persisted-1',
        sessionId: 'digest-session:historic',
        title: 'Persisted entry 1',
        summary: 'Previously saved digest entry 1',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$persisted-1', quote: 'Previously saved digest entry 1' }],
        citationEventIds: ['$persisted-1'],
        createdAt: 90,
        updatedAt: 90,
      },
      {
        id: 'digest:$persisted-2',
        sessionId: 'digest-session:historic',
        title: 'Persisted entry 2',
        summary: 'Previously saved digest entry 2',
        relevance: 'follow',
        citations: [{ roomId: '!room:muon.dev', eventId: '$persisted-2', quote: 'Previously saved digest entry 2' }],
        citationEventIds: ['$persisted-2'],
        createdAt: 95,
        updatedAt: 95,
      },
    ])

    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    // sourceEvents is empty (simulates panel reopen — no runtime events ingested yet)
    expect(store.sourceEvents).toHaveLength(0)

    await store.initializeDigest({ lastOfflineAt: 1000, now: 2000 })

    // After initialize, hydrated entries from Dexie should be preserved
    // (not overwritten by empty materialization from sourceEvents)
    expect(store.entries).toHaveLength(2)
    expect(store.entries.map(e => e.id)).toContain('digest:$persisted-1')
    expect(store.entries.map(e => e.id)).toContain('digest:$persisted-2')
  })

  it('buildDigestSession does not overwrite hydrated entries with empty materialization', async () => {
    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    // Directly set entries to simulate prior hydration
    store.entries = [
      {
        id: 'digest:$hydrated-1',
        sessionId: 'digest-session:hydrated',
        title: 'Hydrated entry 1',
        summary: 'Previously hydrated digest entry 1',
        relevance: 'mention',
        citations: [{ roomId: '!room:muon.dev', eventId: '$hydrated-1', quote: 'Previously hydrated digest entry 1' }],
        citationEventIds: ['$hydrated-1'],
        createdAt: 80,
        updatedAt: 80,
      },
      {
        id: 'digest:$hydrated-2',
        sessionId: 'digest-session:hydrated',
        title: 'Hydrated entry 2',
        summary: 'Previously hydrated digest entry 2',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$hydrated-2', quote: 'Previously hydrated digest entry 2' }],
        citationEventIds: ['$hydrated-2'],
        createdAt: 85,
        updatedAt: 85,
      },
    ]

    // sourceEvents is empty — buildDigestSession should not wipe out existing entries
    expect(store.sourceEvents).toHaveLength(0)

    await store.buildDigestSession({ lastOfflineAt: 1000, now: 2000 })

    // Hydrated entries should still be present (merge-on-empty semantics)
    expect(store.entries).toHaveLength(2)
    expect(store.entries.map(e => e.id)).toContain('digest:$hydrated-1')
    expect(store.entries.map(e => e.id)).toContain('digest:$hydrated-2')
  })

  it('materializes responsibility > follow > mention from real room and user signals', async () => {
    getRoomSummariesMock.mockReturnValue([
      { roomId: '!responsibility:muon.dev', isPinned: false, highlightCount: 2 },
      { roomId: '!follow:muon.dev', isPinned: true, highlightCount: 0 },
      { roomId: '!mention:muon.dev', isPinned: false, highlightCount: 0 },
    ])

    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    store.ingestEvent({ roomId: '!mention:muon.dev', eventId: '$mention', sender: '@alice:muon.dev', body: 'General mention', ts: 170 })
    store.ingestEvent({ roomId: '!follow:muon.dev', eventId: '$follow', sender: '@alice:muon.dev', body: 'Pinned room update', ts: 180 })
    store.ingestEvent({ roomId: '!responsibility:muon.dev', eventId: '$responsibility', sender: '@alice:muon.dev', body: 'Action needed from @me:muon.dev', ts: 160 })

    await store.buildDigestSession({ now: 200 })

    expect(store.entries.map(entry => ({ eventId: entry.citations[0]?.eventId, relevance: entry.relevance }))).toEqual([
      { eventId: '$responsibility', relevance: 'responsibility' },
      { eventId: '$follow', relevance: 'follow' },
      { eventId: '$mention', relevance: 'mention' },
    ])
  })
})
