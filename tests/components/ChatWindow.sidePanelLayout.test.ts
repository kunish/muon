import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({ typingUsers: [] }),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

function stub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

const stubs = {
  ChatHeader: stub('ChatHeaderStub', 'stub-chat-header'),
  MessageList: stub('MessageListStub', 'stub-message-list'),
  RichTextInput: stub('RichTextInputStub', 'stub-rich-text-input'),
  ChatDocsList: stub('ChatDocsListStub', 'stub-chat-docs'),
  ChatFileList: stub('ChatFileListStub', 'stub-chat-files'),
  TypingIndicator: stub('TypingIndicatorStub', 'stub-typing-indicator'),
  MultiSelectBar: stub('MultiSelectBarStub', 'stub-multi-select-bar'),
  GlobalSearch: stub('GlobalSearchStub', 'stub-search'),
  ThreadInboxPanel: stub('ThreadInboxPanelStub', 'stub-thread-inbox'),
  PinnedMessages: stub('PinnedMessagesStub', 'stub-pinned'),
  StarredMessages: stub('StarredMessagesStub', 'stub-starred'),
  MemberListPanel: stub('MemberListPanelStub', 'stub-members'),
  ChatSettingsPanel: stub('ChatSettingsPanelStub', 'stub-settings'),
  KnowledgeCapturePanel: stub('KnowledgeCapturePanelStub', 'stub-knowledge'),
  TaskPanel: stub('TaskPanelStub', 'stub-tasks'),
  ThreadPanel: stub('ThreadPanelStub', 'stub-thread-panel'),
  MediaViewer: stub('MediaViewerStub', 'stub-media-viewer'),
  EmojiEffectLayer: stub('EmojiEffectLayerStub', 'stub-emoji-effect-layer'),
}

async function flushUi() {
  await Promise.resolve()
  await nextTick()
}

describe('chatWindow side panel layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useChatStore().setCurrentRoom('!room:muon.dev')
  })

  function mountChatWindow() {
    return mount(ChatWindow, {
      global: {
        stubs,
      },
    })
  }

  it('animates the shared side panel from a stable width shell instead of direct flex insertion', async () => {
    const store = useChatStore()
    const wrapper = mountChatWindow()

    let shell = wrapper.get('[data-testid="chat-side-panel-shell"]')
    expect(shell.classes()).toEqual(expect.arrayContaining([
      'w-0',
      'border-transparent',
      'transition-[width,border-color]',
      'overflow-hidden',
      'shrink-0',
    ]))
    expect(shell.classes()).not.toContain('transition-all')
    expect(wrapper.find('[data-testid="chat-side-panel-frame"]').exists()).toBe(false)

    store.toggleSidePanel('settings')
    await flushUi()

    shell = wrapper.get('[data-testid="chat-side-panel-shell"]')
    expect(shell.classes()).toContain('w-[320px]')
    expect(shell.classes()).toContain('border-border')
    expect(shell.classes()).not.toContain('w-0')

    const frame = wrapper.get('[data-testid="chat-side-panel-frame"]')
    expect(frame.classes()).toEqual(expect.arrayContaining([
      'h-full',
      'w-[320px]',
      'overflow-hidden',
    ]))
    expect(wrapper.get('[data-testid="stub-settings"]').exists()).toBe(true)

    store.closeSidePanel()
    await flushUi()

    shell = wrapper.get('[data-testid="chat-side-panel-shell"]')
    expect(shell.classes()).toContain('w-0')
    expect(shell.classes()).toContain('border-transparent')
  })

  it('uses the same stable shell pattern for opened thread panels', async () => {
    const store = useChatStore()
    const wrapper = mountChatWindow()

    let shell = wrapper.get('[data-testid="thread-panel-shell"]')
    expect(shell.classes()).toEqual(expect.arrayContaining([
      'w-0',
      'border-transparent',
      'transition-[width,border-color]',
      'overflow-hidden',
      'shrink-0',
    ]))
    expect(shell.classes()).not.toContain('transition-all')

    store.openThread('$thread-root')
    await flushUi()

    shell = wrapper.get('[data-testid="thread-panel-shell"]')
    expect(shell.classes()).toContain('w-[360px]')
    expect(shell.classes()).toContain('border-border')

    const frame = wrapper.get('[data-testid="thread-panel-frame"]')
    expect(frame.classes()).toEqual(expect.arrayContaining([
      'h-full',
      'w-[360px]',
      'overflow-hidden',
    ]))
    expect(wrapper.get('[data-testid="stub-thread-panel"]').exists()).toBe(true)

    store.closeThread()
    await flushUi()

    shell = wrapper.get('[data-testid="thread-panel-shell"]')
    expect(shell.classes()).toContain('w-0')
    expect(shell.classes()).toContain('border-transparent')
  })
})
