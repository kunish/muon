import { mount, shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import CrossSessionQaPanel from '@/features/chat/components/CrossSessionQaPanel.vue'
import KnowledgeCapturePanel from '@/features/chat/components/KnowledgeCapturePanel.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const askCrossSessionQuestionMock = vi.fn()
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
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
  })

  it('asks a question and renders the cited answer', async () => {
    askCrossSessionQuestionMock.mockResolvedValue({
      id: 'qa-1',
      question: 'What should ship this week?',
      answer: 'Digest panel should ship this week.',
      citations: [{ roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Digest panel should ship this week.' }],
    })

    const wrapper = mount(CrossSessionQaPanel)
    await wrapper.get('[data-testid="qa-question-input"]').setValue('What should ship this week?')
    await wrapper.get('[data-testid="qa-submit-button"]').trigger('click')

    expect(askCrossSessionQuestionMock).toHaveBeenCalledWith('What should ship this week?')
    expect(wrapper.text()).toContain('Digest panel should ship this week.')
  })

  it('supports citation click with preload fallback navigation', async () => {
    askCrossSessionQuestionMock.mockResolvedValue({
      id: 'qa-1',
      question: 'What should ship this week?',
      answer: 'Digest panel should ship this week.',
      citations: [{ roomId: '!joined:muon.dev', eventId: '$event-1', quote: 'Digest panel should ship this week.' }],
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
