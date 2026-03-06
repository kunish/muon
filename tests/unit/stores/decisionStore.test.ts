import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const listDecisionCardsMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDecisionCards: (...args: unknown[]) => listDecisionCardsMock(...args),
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

describe('decisionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    listDecisionCardsMock.mockReset()
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockReset()
    listDigestEntriesMock.mockResolvedValue([])
    saveDecisionCardMock.mockReset()
    saveDecisionCardMock.mockImplementation(async card => card)
    updateSuggestionDispositionMock.mockReset()
    updateSuggestionDispositionMock.mockImplementation(async (_decisionId, _suggestionId, disposition, updatedBy, updatedAt) => ({
      suggestions: [{ id: 'suggestion-1', disposition, updatedBy, updatedAt }],
      updatedAt,
    }))
  })

  it('createDecisionCard 必须保存 conclusion/context/owner/status/citations', async () => {
    const { useDecisionStore } = await import('@/features/chat/stores/decisionStore')
    const store = useDecisionStore()

    const card = await store.createDecisionCard({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [{ id: 'suggestion-1', kind: 'action', summary: 'Create panel', citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }] }],
      now: 100,
    })

    expect(card.conclusion).toBe('Ship digest panel')
    expect(card.context).toBe('Offline catch-up is missing')
    expect(card.owner).toBe('@alice:muon.dev')
    expect(card.status).toBe('open')
    expect(card.citations).toHaveLength(1)
    expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
  })

  it('hydrateCards restores saved cards and materializes digest-backed pending suggestions', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-saved-1',
        conclusion: 'Keep current rollout window',
        context: 'Existing saved decision',
        owner: '@alice:muon.dev',
        status: 'confirmed',
        citations: [{ roomId: '!room:muon.dev', eventId: '$saved-1' }],
        citationEventIds: ['$saved-1'],
        suggestions: [],
        createdAt: 50,
        updatedAt: 60,
      },
    ])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-1',
        sessionId: 'digest-session-1',
        title: 'Digest: rollout follow-up',
        summary: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1', quote: 'Need follow-up' }],
        citationEventIds: ['$digest-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { useDecisionStore } = await import('@/features/chat/stores/decisionStore')
    const store = useDecisionStore()

    await store.hydrateCards()

    expect(listDecisionCardsMock).toHaveBeenCalledTimes(1)
    expect(listDigestEntriesMock).toHaveBeenCalledTimes(1)
    expect(store.cards.map(card => card.id)).toEqual(['decision:digest:digest-1', 'decision-saved-1'])
    expect(store.cards[0]).toMatchObject({
      conclusion: 'Digest: rollout follow-up',
      context: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
      owner: 'digest',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1', quote: 'Need follow-up' }],
    })
    expect(store.cards[0]?.suggestions).toEqual([
      expect.objectContaining({
        id: 'digest-1:action:0',
        kind: 'action',
        summary: 'Follow up with Alice.',
        disposition: 'pending',
      }),
      expect.objectContaining({
        id: 'digest-1:blocker:0',
        kind: 'blocker',
        summary: 'Waiting on legal sign-off.',
        disposition: 'pending',
      }),
    ])
  })

  it('hydrateCards preserves accepted or rejected dispositions during digest rematerialization', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision:digest:digest-1',
        conclusion: 'Digest: rollout follow-up',
        context: 'Existing digest-backed draft',
        owner: 'digest',
        status: 'open',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
        citationEventIds: ['$digest-1'],
        suggestions: [
          {
            id: 'digest-1:action:0',
            kind: 'action',
            summary: 'Follow up with Alice.',
            disposition: 'accepted',
            updatedAt: 140,
            updatedBy: '@alice:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
            citationEventIds: ['$digest-1'],
          },
          {
            id: 'digest-1:blocker:0',
            kind: 'blocker',
            summary: 'Waiting on legal sign-off.',
            disposition: 'rejected',
            updatedAt: 141,
            updatedBy: '@bob:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
            citationEventIds: ['$digest-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 141,
      },
    ])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-1',
        sessionId: 'digest-session-1',
        title: 'Digest: rollout follow-up',
        summary: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1' }],
        citationEventIds: ['$digest-1'],
        createdAt: 100,
        updatedAt: 150,
      },
    ])

    const { useDecisionStore } = await import('@/features/chat/stores/decisionStore')
    const store = useDecisionStore()

    await store.hydrateCards()

    expect(store.cards).toHaveLength(1)
    expect(store.cards[0]?.suggestions).toEqual([
      expect.objectContaining({
        id: 'digest-1:action:0',
        disposition: 'accepted',
        updatedBy: '@alice:muon.dev',
        updatedAt: 140,
      }),
      expect.objectContaining({
        id: 'digest-1:blocker:0',
        disposition: 'rejected',
        updatedBy: '@bob:muon.dev',
        updatedAt: 141,
      }),
    ])
  })

  it('AI suggestions default to pending and only transition to accepted/rejected', async () => {
    const { useDecisionStore } = await import('@/features/chat/stores/decisionStore')
    const store = useDecisionStore()

    await store.createDecisionCard({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [{ id: 'suggestion-1', kind: 'action', summary: 'Create panel', citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }] }],
      now: 100,
    })

    expect(store.cards[0]?.suggestions[0]?.disposition).toBe('pending')
    await store.setSuggestionDisposition('decision-1', 'suggestion-1', 'accepted', '@alice:muon.dev', 120)
    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith('decision-1', 'suggestion-1', 'accepted', '@alice:muon.dev', 120)
    await expect(store.setSuggestionDisposition('decision-1', 'suggestion-1', 'pending', '@alice:muon.dev', 121)).rejects.toThrowError()
  })

  it('accept/reject 保留审计字段 updatedAt/updatedBy', async () => {
    const { useDecisionStore } = await import('@/features/chat/stores/decisionStore')
    const store = useDecisionStore()

    await store.createDecisionCard({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [{ id: 'suggestion-1', kind: 'action', summary: 'Create panel', citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }] }],
      now: 100,
    })

    await store.setSuggestionDisposition('decision-1', 'suggestion-1', 'rejected', '@bob:muon.dev', 150)

    expect(store.cards[0]?.suggestions[0]).toMatchObject({
      disposition: 'rejected',
      updatedBy: '@bob:muon.dev',
      updatedAt: 150,
    })
  })
})
