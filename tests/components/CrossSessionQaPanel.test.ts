import { mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import CrossSessionQaPanel from '@/features/chat/components/CrossSessionQaPanel.vue'
import KnowledgeCapturePanel from '@/features/chat/components/KnowledgeCapturePanel.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'
import { useQaStore } from '@/features/chat/stores/qaStore'

const askCrossSessionQuestionMock = vi.fn()
const listSavedQaSessionsMock = vi.fn()
const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
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

describe('CrossSessionQaPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    askCrossSessionQuestionMock.mockReset()
    listSavedQaSessionsMock.mockReset()
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
  })

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

    const wrapper = mount(CrossSessionQaPanel)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Latest answer')
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

    const wrapper = mount(CrossSessionQaPanel)
    await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')

    expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What should ship this week?')
    expect(wrapper.text()).toContain('Digest panel should ship this week.')
    expect(wrapper.text()).toContain('Earlier question')

    const store = useQaStore()
    expect(store.history.map(item => item.id)).toEqual(['qa-2', 'qa-1'])
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

    const wrapper = mount(CrossSessionQaPanel)
    await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')
    await wrapper.get('[data-testid="qa-citation-$event-1"]').trigger('click')

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!joined:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: { focusEventId: '$event-1' },
    })
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })

  it('integrates knowledge tabs and chat side-panel toggle', async () => {
    const knowledgeWrapper = mount(KnowledgeCapturePanel)
    await knowledgeWrapper.get('[data-testid="knowledge-tab-qa"]').trigger('click')
    expect(knowledgeWrapper.findComponent(CrossSessionQaPanel).exists()).toBe(true)

    const chatStore = useChatStore()
    const chatWindow = shallowMount(ChatWindow, {
      global: {
        stubs: {
          Transition: false,
        },
      },
    })

    chatStore.toggleSidePanel('knowledge')
    await nextTick()

    expect(chatStore.activeSidePanel).toBe('knowledge')
    expect(chatWindow.find('knowledge-capture-panel-stub').exists()).toBe(true)
  })
})
