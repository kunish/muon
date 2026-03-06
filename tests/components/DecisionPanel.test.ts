import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import DecisionPanel from '@/features/chat/components/DecisionPanel.vue'
import { useDecisionStore } from '@/features/chat/stores/decisionStore'

const saveDecisionCardMock = vi.fn()
const updateSuggestionDispositionMock = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}))

vi.mock('@/shared/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    saveDecisionCard: (...args: unknown[]) => saveDecisionCardMock(...args),
    updateSuggestionDisposition: (...args: unknown[]) => updateSuggestionDispositionMock(...args),
  }),
}))

describe('DecisionPanel', () => {
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
})
