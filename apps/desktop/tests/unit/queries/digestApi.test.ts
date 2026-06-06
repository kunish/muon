import type { DigestSourceEvent } from '@/features/chat/types/digest'
import type { DigestEntry, DigestRelevance } from '@/features/chat/types/knowledge'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildDigestSession,
  loadDigestEntries,
  materializeDigestSession,
  selectVisibleDigestEntries,
} from '@/features/chat/queries/digestApi'

const listDigestEntriesMock = vi.fn()
const saveDigestEntryMock = vi.fn()
const materializeOfflineDigestMock = vi.fn()

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDigestEntry: (...args: unknown[]) => saveDigestEntryMock(...args),
  }),
}))

vi.mock('@/matrix/digest', () => ({
  materializeOfflineDigest: (...args: unknown[]) => materializeOfflineDigestMock(...args),
}))

function entry(id: string, relevance: DigestRelevance, createdAt: number, eventId = `$${id}`): DigestEntry {
  return {
    id: `digest:${id}`,
    sessionId: 'digest-session:test',
    title: `Title ${id}`,
    summary: `Summary ${id}`,
    relevance,
    citations: [{ roomId: '!room:muon.dev', eventId, quote: `Summary ${id}` }],
    citationEventIds: [eventId],
    createdAt,
    updatedAt: createdAt,
  }
}

function sourceEvent(id: string, ts: number): DigestSourceEvent {
  return {
    roomId: '!room:muon.dev',
    eventId: `$${id}`,
    sender: '@alice:muon.dev',
    body: `Body ${id}`,
    ts,
  }
}

beforeEach(() => {
  listDigestEntriesMock.mockReset()
  saveDigestEntryMock.mockReset()
  materializeOfflineDigestMock.mockReset()
  listDigestEntriesMock.mockResolvedValue([])
  saveDigestEntryMock.mockResolvedValue(undefined)
})

describe('digestApi', () => {
  it('loadDigestEntries sorts by relevance priority then createdAt desc', async () => {
    listDigestEntriesMock.mockResolvedValue([
      entry('mention', 'mention', 200),
      entry('responsibility', 'responsibility', 100),
      entry('follow', 'follow', 150),
    ])

    const entries = await loadDigestEntries()

    expect(listDigestEntriesMock).toHaveBeenCalledTimes(1)
    expect(entries.map((item) => item.relevance)).toEqual(['responsibility', 'follow', 'mention'])
  })

  it('loadDigestEntries returns an empty list when nothing is persisted', async () => {
    const entries = await loadDigestEntries()
    expect(entries).toEqual([])
  })

  it('selectVisibleDigestEntries returns all entries sorted with an eventId from the first citation', () => {
    const visible = selectVisibleDigestEntries(
      [entry('mention', 'mention', 200), entry('responsibility', 'responsibility', 100)],
      'all',
    )

    expect(visible.map((item) => item.relevance)).toEqual(['responsibility', 'mention'])
    expect(visible.map((item) => item.eventId)).toEqual(['$responsibility', '$mention'])
  })

  it('selectVisibleDigestEntries filters by the active relevance', () => {
    const visible = selectVisibleDigestEntries(
      [entry('a', 'responsibility', 100), entry('b', 'follow', 90), entry('c', 'responsibility', 80)],
      'responsibility',
    )

    expect(visible.map((item) => item.id)).toEqual(['digest:a', 'digest:c'])
  })

  it('selectVisibleDigestEntries falls back to the entry id when a citation is missing', () => {
    const orphan = { ...entry('orphan', 'mention', 100), citations: [] } as unknown as DigestEntry

    const visible = selectVisibleDigestEntries([orphan], 'all')

    expect(visible[0]?.eventId).toBe('digest:orphan')
  })

  it('materializeDigestSession formats the sessionId and forwards the window', () => {
    const session = { id: 'digest-session:100:200', entries: [], windowStart: 100, windowEnd: 200, createdAt: 200 }
    materializeOfflineDigestMock.mockReturnValue(session)
    const events = [sourceEvent('one', 150)]

    const result = materializeDigestSession(events, { windowStart: 100, windowEnd: 200 })

    expect(materializeOfflineDigestMock).toHaveBeenCalledWith(events, {
      sessionId: 'digest-session:100:200',
      windowStart: 100,
      windowEnd: 200,
    })
    expect(result).toBe(session)
  })

  it('buildDigestSession persists each materialized entry and returns them when non-empty', async () => {
    const built = [entry('responsibility', 'responsibility', 160), entry('mention', 'mention', 150)]
    materializeOfflineDigestMock.mockReturnValue({
      id: 'digest-session:100:200',
      entries: built,
      windowStart: 100,
      windowEnd: 200,
      createdAt: 200,
    })

    const result = await buildDigestSession([sourceEvent('one', 150)], { windowStart: 100, windowEnd: 200 })

    expect(saveDigestEntryMock).toHaveBeenCalledTimes(2)
    expect(saveDigestEntryMock).toHaveBeenCalledWith(built[0])
    expect(saveDigestEntryMock).toHaveBeenCalledWith(built[1])
    expect(result).toEqual(built)
  })

  it('buildDigestSession persists nothing and returns an empty list when materialization is empty', async () => {
    materializeOfflineDigestMock.mockReturnValue({
      id: 'digest-session:100:200',
      entries: [],
      windowStart: 100,
      windowEnd: 200,
      createdAt: 200,
    })

    const result = await buildDigestSession([], { windowStart: 100, windowEnd: 200 })

    expect(saveDigestEntryMock).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})
