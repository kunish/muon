import type { DecisionCard } from '@/features/chat/types/decision'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DecisionPanel from '@/features/chat/components/DecisionPanel.vue'
import { decisionKeys } from '@/features/chat/queries/decisionKeys'
import { createTestQueryClient } from '../helpers/queryClient'

const listDecisionCardsMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()
const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const toastErrorMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: (...args: unknown[]) => toastErrorMock(...args),
  },
}))

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDecisionCards: (...args: unknown[]) => listDecisionCardsMock(...args),
    listDigestEntries: (...args: unknown[]) => listDigestEntriesMock(...args),
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@matrix/index')>()
  return {
    ...actual,
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
  }
})

describe('decisionPanel', () => {
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
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    toastErrorMock.mockReset()
  })

  function mountPanel() {
    const queryClient = createTestQueryClient()
    const wrapper = mount(DecisionPanel, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    return { wrapper, queryClient }
  }

  it('creates a decision card from panel inputs', async () => {
    const { wrapper } = mountPanel()

    await wrapper.get('[data-testid="decision-conclusion-input"]').setValue('Ship digest panel')
    await wrapper.get('[data-testid="decision-context-input"]').setValue('Offline catch-up is missing')
    await wrapper.get('[data-testid="group-member-search"]').setValue('@alice:muon.dev')
    await wrapper.get('[data-testid="group-member-row-@alice:muon.dev"]').trigger('click')
    await wrapper.get('[data-testid="decision-room-input"]').setValue('!room:muon.dev')
    await wrapper.get('[data-testid="decision-event-input"]').setValue('$event-1')
    await wrapper.get('[data-testid="decision-save-button"]').trigger('click')
    await flushPromises()

    expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
    // Assert the card rendered in the v-for list from the query cache, not merely that
    // the (uncleared) form input still shows the typed conclusion.
    const renderedCard = wrapper.get('[data-testid^="decision-card-"]')
    expect(renderedCard.text()).toContain('Ship digest panel')
  })

  it('shows all missing fields before saving a decision card', async () => {
    const { wrapper } = mountPanel()

    await wrapper.get('[data-testid="decision-conclusion-input"]').setValue('确认发布窗口')
    await wrapper.get('[data-testid="decision-save-button"]').trigger('click')

    expect(saveDecisionCardMock).not.toHaveBeenCalled()
    expect(toastErrorMock).toHaveBeenCalledTimes(1)
    expect(toastErrorMock.mock.calls[0]?.[0]).toContain('上下文')
    expect(toastErrorMock.mock.calls[0]?.[0]).toContain('负责人')
    expect(toastErrorMock.mock.calls[0]?.[0]).toContain('房间 ID')
    expect(toastErrorMock.mock.calls[0]?.[0]).toContain('事件 ID')
    expect(toastErrorMock.mock.calls[0]?.[0]).not.toContain('结论')
  })

  it('accepts a suggestion through the mutation', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-1',
        conclusion: 'Ship digest panel',
        context: 'Offline catch-up is missing',
        owner: '@alice:muon.dev',
        status: 'open',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        citationEventIds: ['$event-1'],
        suggestions: [
          {
            id: 'suggestion-1',
            kind: 'action',
            summary: 'Create panel',
            disposition: 'pending',
            updatedAt: 100,
            citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
            citationEventIds: ['$event-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { wrapper } = mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="decision-accept-suggestion-1"]').trigger('click')

    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
      'decision-1',
      'suggestion-1',
      'accepted',
      'local-user',
      expect.any(Number),
    )
  })

  it('rejects a suggestion through the mutation', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-1',
        conclusion: 'Ship digest panel',
        context: 'Offline catch-up is missing',
        owner: '@alice:muon.dev',
        status: 'open',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        citationEventIds: ['$event-1'],
        suggestions: [
          {
            id: 'suggestion-1',
            kind: 'blocker',
            summary: 'Need audit trail',
            disposition: 'pending',
            updatedAt: 100,
            citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
            citationEventIds: ['$event-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { wrapper } = mountPanel()
    await flushPromises()
    await wrapper.get('[data-testid="decision-reject-suggestion-1"]').trigger('click')

    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith(
      'decision-1',
      'suggestion-1',
      'rejected',
      'local-user',
      expect.any(Number),
    )
  })

  it('localizes decision status and digest suggestion metadata', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-1',
        conclusion: '确认发布窗口',
        context: '需要沉淀上下文',
        owner: '@alice:muon.dev',
        status: 'confirmed',
        citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
        citationEventIds: ['$event-1'],
        suggestions: [
          {
            id: 'suggestion-1',
            kind: 'action',
            summary: '同步发布负责人',
            disposition: 'accepted',
            updatedAt: 100,
            updatedBy: '@alice:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
            citationEventIds: ['$event-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { wrapper } = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('已确认')
    expect(wrapper.text()).toContain('行动项')
    expect(wrapper.text()).toContain('摘要建议')
    expect(wrapper.text()).toContain('已接受')
    expect(wrapper.text()).not.toContain('digest summary')
    expect(wrapper.text()).not.toContain('accepted')
  })

  it('digest-backed suggestions are visible only from latest-session digest entries', async () => {
    listDecisionCardsMock.mockResolvedValue([])
    listDigestEntriesMock.mockResolvedValue([
      {
        id: 'digest-latest-1',
        sessionId: 'session-latest',
        title: 'Latest session entry',
        summary: 'Action: Schedule the release call. Blocker: Missing sign-off from legal.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$latest-1', quote: 'Schedule the release call' }],
        citationEventIds: ['$latest-1'],
        createdAt: 300,
        updatedAt: 300,
      },
      {
        id: 'digest-old-1',
        sessionId: 'session-old',
        title: 'Old session entry',
        summary: 'Action: Review the design doc. Blocker: Pending stakeholder feedback.',
        relevance: 'responsibility',
        citations: [{ roomId: '!room:muon.dev', eventId: '$old-1', quote: 'Review the design doc' }],
        citationEventIds: ['$old-1'],
        createdAt: 50,
        updatedAt: 50,
      },
    ])

    const { wrapper, queryClient } = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Schedule the release call')
    expect(wrapper.text()).not.toContain('Review the design doc')

    const cards = queryClient.getQueryData<DecisionCard[]>(decisionKeys.cards()) ?? []
    const digestCards = cards.filter((card) => card.owner === 'digest')
    expect(digestCards).toHaveLength(1)
    expect(digestCards[0]?.id).toBe('decision:digest:digest-latest-1')
  })

  it('hydrates saved decisions, renders linked messages, and jumps with preload plus focusEventId', async () => {
    listDecisionCardsMock.mockResolvedValue([
      {
        id: 'decision-1',
        conclusion: 'Keep current rollout window',
        context: 'Need traceable decision context',
        owner: '@alice:muon.dev',
        status: 'confirmed',
        citations: [
          { roomId: '!room:muon.dev', eventId: '$event-1', quote: 'Original discussion' },
          { roomId: '!room:muon.dev', eventId: '$event-2', quote: 'Follow-up question' },
        ],
        citationEventIds: ['$event-1', '$event-2'],
        suggestions: [
          {
            id: 'suggestion-1',
            kind: 'action',
            summary: 'Follow up with release manager.',
            disposition: 'accepted',
            updatedAt: 200,
            updatedBy: '@alice:muon.dev',
            citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
            citationEventIds: ['$event-1'],
          },
        ],
        createdAt: 100,
        updatedAt: 200,
      },
    ])
    loadInboxEventContextMock.mockResolvedValue({})

    const { wrapper } = mountPanel()
    await flushPromises()

    expect(wrapper.text()).toContain('Keep current rollout window')
    expect(wrapper.text()).toContain('Follow up with release manager.')
    expect(wrapper.text()).toContain('已接受')
    expect(wrapper.find('[data-testid="decision-linked-message-$event-1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="decision-linked-message-$event-2"]').exists()).toBe(true)

    await wrapper.get('[data-testid="decision-linked-message-$event-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!room:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!room%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
  })
})
