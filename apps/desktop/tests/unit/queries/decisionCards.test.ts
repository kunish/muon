import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createDecisionCardEntry,
  loadDecisionCards,
  setSuggestionDispositionEntry,
  upsertDecisionCard,
} from '@/features/chat/queries/decisionCardsApi'

const listDecisionCardsMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDecisionCards: (...args: unknown[]) => listDecisionCardsMock(...args),
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

beforeEach(() => {
  listDecisionCardsMock.mockReset()
  listDecisionCardsMock.mockResolvedValue([])
  listDigestEntriesMock.mockReset()
  listDigestEntriesMock.mockResolvedValue([])
  saveDecisionCardMock.mockReset()
  saveDecisionCardMock.mockImplementation(async (card) => card)
  updateSuggestionDispositionMock.mockReset()
  updateSuggestionDispositionMock.mockImplementation(
    async (_decisionId, _suggestionId, disposition, updatedBy, updatedAt) => ({
      suggestions: [{ id: 'suggestion-1', disposition, updatedBy, updatedAt }],
      updatedAt,
    }),
  )
})

describe('decisionCardsApi', () => {
  it('createDecisionCardEntry 必须保存 conclusion/context/owner/status/citations', async () => {
    const card = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    expect(card.conclusion).toBe('Ship digest panel')
    expect(card.context).toBe('Offline catch-up is missing')
    expect(card.owner).toBe('@alice:muon.dev')
    expect(card.status).toBe('open')
    expect(card.citations).toHaveLength(1)
    expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
  })

  it('loadDecisionCards restores saved cards and materializes digest-backed pending suggestions', async () => {
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

    const cards = await loadDecisionCards()

    expect(listDecisionCardsMock).toHaveBeenCalledTimes(1)
    expect(listDigestEntriesMock).toHaveBeenCalledTimes(1)
    expect(cards.map((card) => card.id)).toEqual(['decision:digest:digest-1', 'decision-saved-1'])
    expect(cards[0]).toMatchObject({
      conclusion: 'Digest: rollout follow-up',
      context: 'Action: Follow up with Alice. Blocker: Waiting on legal sign-off.',
      owner: 'digest',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$digest-1', quote: 'Need follow-up' }],
    })
    expect(cards[0]?.suggestions).toEqual([
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

  it('loadDecisionCards preserves accepted or rejected dispositions during digest rematerialization', async () => {
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

    const cards = await loadDecisionCards()

    expect(cards).toHaveLength(1)
    expect(cards[0]?.suggestions).toEqual([
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

  it('aI suggestions default to pending and only transition to accepted/rejected', async () => {
    const created = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    expect(created.suggestions[0]?.disposition).toBe('pending')

    await setSuggestionDispositionEntry(created, 'suggestion-1', 'accepted', '@alice:muon.dev', 120)
    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
      'decision-1',
      'suggestion-1',
      'accepted',
      '@alice:muon.dev',
      120,
    )

    await expect(
      // @ts-expect-error pending is not an assignable disposition — runtime must also reject
      setSuggestionDispositionEntry(created, 'suggestion-1', 'pending', '@alice:muon.dev', 121),
    ).rejects.toThrowError()
  })

  it('loadDecisionCards only materializes digest-backed suggestions from the latest session', async () => {
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-current-1',
        sessionId: 'session-current',
        title: 'Current session entry 1',
        summary: 'Action: Deploy the hotfix immediately.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-1', quote: 'Deploy the hotfix' }],
        citationEventIds: ['$current-1'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'digest-current-2',
        sessionId: 'session-current',
        title: 'Current session entry 2',
        summary: 'Blocker: Waiting on QA approval.',
        relevance: 'follow',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-2', quote: 'QA approval needed' }],
        citationEventIds: ['$current-2'],
        createdAt: 210,
        updatedAt: 210,
      },
      {
        id: 'digest-old-1',
        sessionId: 'session-old',
        title: 'Old session entry',
        summary: 'Action: Review the PR from last week. Blocker: Merge conflict unresolved.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$old-1', quote: 'Review the PR' }],
        citationEventIds: ['$old-1'],
        createdAt: 50,
        updatedAt: 50,
      },
    ])

    const cards = await loadDecisionCards()

    const digestCardIds = cards.filter((card) => card.owner === 'digest').map((card) => card.id)
    expect(digestCardIds).toContain('decision:digest:digest-current-1')
    expect(digestCardIds).toContain('decision:digest:digest-current-2')
    expect(digestCardIds).not.toContain('decision:digest:digest-old-1')
  })

  it('stale digest entries from older sessions do not generate new suggestion cards', async () => {
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-current-quiet',
        sessionId: 'session-current',
        title: 'Current session quiet entry',
        summary: 'General discussion about project timeline.',
        relevance: 'mention',
        citations: [{ roomId: '!room:muon.dev', eventId: '$current-quiet', quote: 'General discussion' }],
        citationEventIds: ['$current-quiet'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'digest-stale-1',
        sessionId: 'session-ancient',
        title: 'Ancient session entry',
        summary: 'Action: Refactor the auth module. Blocker: Missing test coverage.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$stale-1', quote: 'Refactor auth' }],
        citationEventIds: ['$stale-1'],
        createdAt: 10,
        updatedAt: 10,
      },
    ])

    const cards = await loadDecisionCards()

    const digestCards = cards.filter((card) => card.owner === 'digest')
    expect(digestCards).toHaveLength(0)
  })

  it('accept/reject 保留审计字段 updatedAt/updatedBy', async () => {
    const created = await createDecisionCardEntry({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [
        {
          id: 'suggestion-1',
          kind: 'action',
          summary: 'Create panel',
          citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        },
      ],
      now: 100,
    })

    const updated = await setSuggestionDispositionEntry(created, 'suggestion-1', 'rejected', '@bob:muon.dev', 150)

    expect(updated.suggestions[0]).toMatchObject({
      disposition: 'rejected',
      updatedBy: '@bob:muon.dev',
      updatedAt: 150,
    })
  })

  it('upsertDecisionCard replaces by id and keeps updatedAt-desc order', () => {
    const a = { id: 'a', updatedAt: 10 } as never
    const b = { id: 'b', updatedAt: 30 } as never
    const aNewer = { id: 'a', updatedAt: 40 } as never

    const next = upsertDecisionCard([a, b], aNewer)

    expect(next.map((card) => (card as { id: string }).id)).toEqual(['a', 'b'])
    expect(next).toHaveLength(2)
  })
})
