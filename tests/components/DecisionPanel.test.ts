import { mount } from '@vue/test-utils'
import { flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DecisionPanel from '@/features/chat/components/DecisionPanel.vue'
import { useDecisionStore } from '@/features/chat/stores/decisionStore'

const listDecisionCardsMock = vi.fn()
const listDigestEntriesMock = vi.fn()
const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()
const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
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

describe('DecisionPanel', () => {
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
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
  })

  it('creates a decision card from panel inputs', async () => {
    const wrapper = mount(DecisionPanel)

    await wrapper.get('[data-testid="decision-conclusion-input"]').setValue('Ship digest panel')
    await wrapper.get('[data-testid="decision-context-input"]').setValue('Offline catch-up is missing')
    await wrapper.get('[data-testid="decision-owner-input"]').setValue('@alice:muon.dev')
    await wrapper.get('[data-testid="decision-room-input"]').setValue('!room:muon.dev')
    await wrapper.get('[data-testid="decision-event-input"]').setValue('$event-1')
    await wrapper.get('[data-testid="decision-save-button"]').trigger('click')

    expect(saveDecisionCardMock).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Ship digest panel')
  })

  it('accepts a suggestion through store action', async () => {
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

    const wrapper = mount(DecisionPanel)
    await wrapper.get('[data-testid="decision-accept-suggestion-1"]').trigger('click')

    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith('decision-1', 'suggestion-1', 'accepted', 'local-user', expect.any(Number))
  })

  it('rejects a suggestion through store action', async () => {
    const store = useDecisionStore()
    await store.createDecisionCard({
      id: 'decision-1',
      conclusion: 'Ship digest panel',
      context: 'Offline catch-up is missing',
      owner: '@alice:muon.dev',
      status: 'open',
      citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }],
      suggestions: [{ id: 'suggestion-1', kind: 'blocker', summary: 'Need audit trail', citations: [{ roomId: '!room:muon.dev', eventId: '$event-1' }] }],
      now: 100,
    })

    const wrapper = mount(DecisionPanel)
    await wrapper.get('[data-testid="decision-reject-suggestion-1"]').trigger('click')

    expect(updateSuggestionDispositionMock).toHaveBeenCalledWith('decision-1', 'suggestion-1', 'rejected', 'local-user', expect.any(Number))
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

    const wrapper = mount(DecisionPanel)
    await flushPromises()

    expect(wrapper.text()).toContain('Keep current rollout window')
    expect(wrapper.text()).toContain('Follow up with release manager.')
    expect(wrapper.text()).toContain('accepted')
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
