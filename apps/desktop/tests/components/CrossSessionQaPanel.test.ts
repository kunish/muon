import type { Component } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { flushPromises, mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import CrossSessionQaPanel from '@/features/chat/components/CrossSessionQaPanel.vue'
import KnowledgeCapturePanel from '@/features/chat/components/KnowledgeCapturePanel.vue'
import { qaKeys } from '@/features/chat/queries/qaKeys'
import { chatStore, resetChatStore, toggleSidePanel } from '@/features/chat/stores/chatStore'
import { resetQaStore, selectQaAnswer } from '@/features/chat/stores/qaStore'
import { createTestQueryClient } from '../helpers/queryClient'

const askCrossSessionQuestionMock = vi.fn()
const listSavedQaSessionsMock = vi.fn()
const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()

vi.mock('@features/chat/lib/knowledgeDb', () => ({
  createKnowledgeRepository: () => ({
    listDigestEntries: vi.fn().mockResolvedValue([]),
    listDecisionCards: vi.fn().mockResolvedValue([]),
    listQaSessions: (...args: unknown[]) => listSavedQaSessionsMock(...args),
    saveQaSession: vi.fn(),
    saveDecisionCard: vi.fn(),
    saveDigestEntry: vi.fn(),
    updateSuggestionDisposition: vi.fn(),
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@/features/chat/services/crossSessionQa', () => ({
  askCrossSessionQuestion: (...args: unknown[]) => askCrossSessionQuestionMock(...args),
  listSavedQaSessions: (...args: unknown[]) => listSavedQaSessionsMock(...args),
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@matrix/index')>()
  return {
    ...actual,
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
  }
})

describe('crossSessionQaPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    resetChatStore()
    resetQaStore()
    askCrossSessionQuestionMock.mockReset()
    listSavedQaSessionsMock.mockReset()
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
  })

  function mountWithQuery(component: Component) {
    const queryClient = createTestQueryClient()
    const wrapper = mount(component, {
      global: { plugins: [[VueQueryPlugin, { queryClient }]] },
    })
    return { wrapper, queryClient }
  }

  it('hydrates the latest saved answer on mount', async () => {
    listSavedQaSessionsMock.mockResolvedValue([
      {
        id: 'qa-2',
        question: 'Latest question',
        answer: 'Latest answer',
        citations: [{ roomId: '!joined:muon.dev', eventId: '$event-2', quote: 'Latest answer' }],
        citationEventIds: ['$event-2'],
        createdAt: 200,
        updatedAt: 200,
      },
      {
        id: 'qa-1',
        question: 'Earlier question',
        answer: 'Earlier answer',
        citations: [{ roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Earlier answer' }],
        citationEventIds: ['$event-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])

    const { wrapper } = mountWithQuery(CrossSessionQaPanel)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Latest answer')
    })
    // The derived active answer is the newest; the older answer must NOT be the active card.
    expect(wrapper.get('[data-testid="qa-answer-card"]').text()).not.toContain('Earlier answer')
  })

  it('surfaces a hydration error when listSavedQaSessions rejects', async () => {
    listSavedQaSessionsMock.mockRejectedValue(new Error('db offline'))

    const { wrapper } = mountWithQuery(CrossSessionQaPanel)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('db offline')
    })
  })

  it('asks a question and renders the cited answer', async () => {
    listSavedQaSessionsMock.mockResolvedValue([
      {
        id: 'qa-1',
        question: 'Earlier question',
        answer: 'Earlier answer',
        citations: [{ roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Earlier answer' }],
        citationEventIds: ['$event-1'],
        createdAt: 100,
        updatedAt: 100,
      },
    ])
    askCrossSessionQuestionMock.mockResolvedValue({
      id: 'qa-2',
      question: 'What should ship this week?',
      answer: 'Digest panel should ship this week.',
      citations: [{ roomId: '!joined:muon.dev', eventId: '$event-2', quote: 'Digest panel should ship this week.' }],
      citationEventIds: ['$event-2'],
      createdAt: 200,
      updatedAt: 200,
    })

    // Pre-select the older answer to prove asking overrides the existing selection.
    selectQaAnswer('qa-1')

    const { wrapper, queryClient } = mountWithQuery(CrossSessionQaPanel)
    await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')
    await flushPromises()

    expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What should ship this week?')
    expect(wrapper.text()).toContain('Digest panel should ship this week.')
    expect(wrapper.text()).toContain('Earlier question')
    // The newly-asked answer is active even though qa-1 was previously selected.
    expect(wrapper.get('[data-testid="qa-answer-card"]').text()).toContain('Digest panel should ship this week.')

    const history = queryClient.getQueryData<{ id: string }[]>(qaKeys.history()) ?? []
    expect(history.map((item) => item.id)).toEqual(['qa-2', 'qa-1'])
  })

  it('supports citation click with preload fallback navigation', async () => {
    listSavedQaSessionsMock.mockResolvedValue([])
    askCrossSessionQuestionMock.mockResolvedValue({
      id: 'qa-1',
      question: 'What should ship this week?',
      answer: 'Digest panel should ship this week.',
      citations: [{ roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Digest panel should ship this week.' }],
      citationEventIds: ['$event-1'],
      createdAt: 100,
      updatedAt: 100,
    })
    loadInboxEventContextMock.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mountWithQuery(CrossSessionQaPanel).wrapper
    await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="qa-citation-$event-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!joined:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('shows a localized empty answer error when no cited answer is available', async () => {
    listSavedQaSessionsMock.mockResolvedValue([])
    askCrossSessionQuestionMock.mockRejectedValue(new Error('No cited answer available'))

    const wrapper = mountWithQuery(CrossSessionQaPanel).wrapper
    await wrapper.get('[data-testid="qa-question-input"]').setValue('有没有上线结论？')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('没有找到可引用的答案')
    })
    expect(wrapper.text()).not.toContain('No cited answer available')
  })

  it('integrates knowledge tabs and chat side-panel toggle', async () => {
    const knowledgeWrapper = mountWithQuery(KnowledgeCapturePanel).wrapper
    await knowledgeWrapper.get('[data-testid="knowledge-tab-qa"]').trigger('click')
    expect(knowledgeWrapper.findComponent(CrossSessionQaPanel).exists()).toBe(true)

    const chatWindow = shallowMount(ChatWindow, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    toggleSidePanel('knowledge')
    await nextTick()

    expect(chatStore.state.activeSidePanel).toBe('knowledge')
    expect(chatWindow.find('knowledge-capture-panel-stub').exists()).toBe(true)
  })
})
