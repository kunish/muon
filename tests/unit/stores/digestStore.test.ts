import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveDigestEntryMock = vi.fn()

vi.mock('@/shared/composables/useNetworkStatus', () => ({
  useNetworkStatus: () => ({
    status: { value: 'online' },
    lastOfflineAt: { value: 100 },
  }),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    saveDigestEntry: (...args: unknown[]) => saveDigestEntryMock(...args),
  }),
}))

describe('digestStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    saveDigestEntryMock.mockReset()
    saveDigestEntryMock.mockResolvedValue(undefined)
  })

  it('buildDigestSession 聚合离线窗口内事件', async () => {
    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$before-window',
      sender: '@alice:muon.dev',
      body: 'Too old',
      ts: 50,
      relevanceHint: 'mention',
    })
    store.ingestEvent({
      roomId: '!room:muon.dev',
      eventId: '$inside-window',
      sender: '@alice:muon.dev',
      body: 'Owner update',
      ts: 150,
      relevanceHint: 'responsibility',
    })

    const entries = await store.buildDigestSession({ now: 200 })

    expect(entries).toHaveLength(1)
    expect(entries[0]?.citations[0]).toEqual({ roomId: '!room:muon.dev', eventId: '$inside-window', quote: 'Owner update' })
    expect(saveDigestEntryMock).toHaveBeenCalledTimes(1)
  })

  it('relevance 排序严格为 responsibility > follow > mention，同级按时间倒序', async () => {
    const { useDigestStore } = await import('@/features/chat/stores/digestStore')
    const store = useDigestStore()

    store.ingestEvent({ roomId: '!room:muon.dev', eventId: '$mention', sender: '@alice:muon.dev', body: 'Mention', ts: 170, relevanceHint: 'mention' })
    store.ingestEvent({ roomId: '!room:muon.dev', eventId: '$follow-new', sender: '@alice:muon.dev', body: 'Follow new', ts: 190, relevanceHint: 'follow' })
    store.ingestEvent({ roomId: '!room:muon.dev', eventId: '$follow-old', sender: '@alice:muon.dev', body: 'Follow old', ts: 180, relevanceHint: 'follow' })
    store.ingestEvent({ roomId: '!room:muon.dev', eventId: '$responsibility', sender: '@alice:muon.dev', body: 'Responsibility', ts: 160, relevanceHint: 'responsibility' })

    await store.buildDigestSession({ now: 200 })

    expect(store.visibleEntries.map(entry => entry.eventId)).toEqual([
      '$responsibility',
      '$follow-new',
      '$follow-old',
      '$mention',
    ])
  })
})
