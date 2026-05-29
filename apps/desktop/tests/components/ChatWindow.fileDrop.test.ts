import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({ typingUsers: [] }),
}))

vi.mock('@/desktop/dialog', () => ({ ask: vi.fn() }))

const acceptDroppedFilesSpy = vi.hoisted(() => vi.fn())

function stub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

const RichTextInputStub = defineComponent({
  name: 'RichTextInputStub',
  setup(_, { expose }) {
    expose({ acceptDroppedFiles: acceptDroppedFilesSpy })
    return () => h('div', { 'data-testid': 'stub-rich-text-input' })
  },
})

const stubs = {
  ChatHeader: stub('ChatHeaderStub', 'stub-chat-header'),
  MessageList: stub('MessageListStub', 'stub-message-list'),
  RichTextInput: RichTextInputStub,
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

function mountChatWindow() {
  return mount(ChatWindow, { global: { stubs } })
}

describe('chatWindow file drag-and-drop', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useChatStore().setCurrentRoom('!room:muon.dev')
    acceptDroppedFilesSpy.mockClear()
  })

  it('shows the drop overlay while files are dragged over the chat area', async () => {
    const wrapper = mountChatWindow()
    expect(wrapper.find('[data-testid="chat-drop-overlay"]').exists()).toBe(false)

    await wrapper.find('[data-chat-area]').trigger('dragover', { dataTransfer: { types: ['Files'], files: [] } })
    await nextTick()

    expect(wrapper.find('[data-testid="chat-drop-overlay"]').exists()).toBe(true)
  })

  it('forwards dropped files to the composer and hides the overlay', async () => {
    const wrapper = mountChatWindow()
    const file = new File(['hello'], 'photo.png', { type: 'image/png' })

    await wrapper.find('[data-chat-area]').trigger('dragover', { dataTransfer: { types: ['Files'], files: [] } })
    await wrapper.find('[data-chat-area]').trigger('drop', { dataTransfer: { types: ['Files'], files: [file] } })
    await nextTick()

    expect(acceptDroppedFilesSpy).toHaveBeenCalledTimes(1)
    expect(acceptDroppedFilesSpy.mock.calls[0][0]).toHaveLength(1)
    expect(acceptDroppedFilesSpy.mock.calls[0][0][0]).toBe(file)
    expect(wrapper.find('[data-testid="chat-drop-overlay"]').exists()).toBe(false)
  })

  it('ignores drags without files', async () => {
    const wrapper = mountChatWindow()
    await wrapper.find('[data-chat-area]').trigger('dragover', { dataTransfer: { types: ['text/plain'], files: [] } })
    await nextTick()
    expect(wrapper.find('[data-testid="chat-drop-overlay"]').exists()).toBe(false)
  })
})
