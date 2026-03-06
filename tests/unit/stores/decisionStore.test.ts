import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

describe('decisionStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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
