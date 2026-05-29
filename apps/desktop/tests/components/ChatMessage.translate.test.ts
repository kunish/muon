import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { translateMock, toastErrorMock } = vi.hoisted(() => ({
  translateMock: {
    translateText: vi.fn(),
    getSystemLanguage: vi.fn(() => 'zh'),
  },
  toastErrorMock: vi.fn(),
}))

vi.mock('@/shared/lib/translate', () => ({
  translateText: translateMock.translateText,
  getSystemLanguage: translateMock.getSystemLanguage,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

function createTextEvent() {
  return {
    getId: () => '$translate-1',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body: 'hello world' }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  }
}

const STUBS = {
  Avatar: true,
  LinkPreview: true,
  ReactionBar: true,
  AudioMessage: true,
  ContactCardMessage: true,
  FileMessage: true,
  ImageMessage: true,
  VideoMessage: true,
  RawMessageDialog: true,
  MessageContextMenu: true,
}

describe('chatMessage translation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches a translation and toggles the rendered result', async () => {
    translateMock.translateText.mockResolvedValue('你好世界')
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
    const MessageActionBar = (await import('@/features/chat/components/MessageActionBar.vue')).default

    const wrapper = mount(ChatMessage, {
      props: {
        event: createTextEvent() as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      attachTo: document.body,
      global: { stubs: { ...STUBS, MessageActionBar: true } },
    })

    // Hover reveals the floating action bar (it is gated behind hover state).
    await wrapper.find('[data-testid="chat-message-row"]').trigger('mouseenter')
    await flushPromises()

    const bar = wrapper.findComponent(MessageActionBar)
    expect(bar.exists()).toBe(true)

    bar.vm.$emit('translate')
    await flushPromises()

    expect(translateMock.translateText).toHaveBeenCalledWith('hello world', 'zh')
    const result = document.body.querySelector('[data-testid="message-translation-result"]')
    expect(result?.textContent).toContain('你好世界')

    // Emitting translate again hides the result (toggle behaviour).
    bar.vm.$emit('translate')
    await flushPromises()
    expect(document.body.querySelector('[data-testid="message-translation-result"]')).toBeNull()

    wrapper.unmount()
  })

  it('surfaces an error toast when translation fails', async () => {
    translateMock.translateText.mockRejectedValue(new Error('network'))
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
    const MessageActionBar = (await import('@/features/chat/components/MessageActionBar.vue')).default

    const wrapper = mount(ChatMessage, {
      props: {
        event: createTextEvent() as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      attachTo: document.body,
      global: { stubs: { ...STUBS, MessageActionBar: true } },
    })

    await wrapper.find('[data-testid="chat-message-row"]').trigger('mouseenter')
    await flushPromises()

    wrapper.findComponent(MessageActionBar).vm.$emit('translate')
    await flushPromises()

    expect(toastErrorMock).toHaveBeenCalled()
    expect(document.body.querySelector('[data-testid="message-translation-result"]')).toBeNull()

    wrapper.unmount()
  })
})
