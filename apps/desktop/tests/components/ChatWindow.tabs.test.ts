import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import { resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

const ChatHeaderStub = defineComponent({
  name: 'ChatHeaderStub',
  emits: ['update:activeTab'],
  setup(_, { emit }) {
    return () =>
      h('div', { 'data-testid': 'chat-header' }, [
        h('button', { 'data-testid': 'tab-chat', onClick: () => emit('update:activeTab', 'chat') }, 'Chat'),
        h('button', { 'data-testid': 'tab-docs', onClick: () => emit('update:activeTab', 'docs') }, 'Docs'),
        h('button', { 'data-testid': 'tab-files', onClick: () => emit('update:activeTab', 'files') }, 'File'),
      ])
  },
})

function stub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({ typingUsers: [] }),
}))

describe('chatWindow tabs', () => {
  beforeEach(() => {
    resetChatStore()
    setCurrentRoom('!room:localhost')
  })

  it('switches between chat, docs, and file views from the Feishu-style header tabs', async () => {
    const wrapper = mount(ChatWindow, {
      global: {
        stubs: {
          ChatHeader: ChatHeaderStub,
          MessageList: stub('MessageListStub', 'message-list'),
          RichTextInput: stub('RichTextInputStub', 'rich-text-input'),
          ChatDocsList: stub('ChatDocsListStub', 'chat-docs-list'),
          ChatFileList: stub('ChatFileListStub', 'chat-file-list'),
          TypingIndicator: stub('TypingIndicatorStub'),
          MultiSelectBar: stub('MultiSelectBarStub'),
          GlobalSearch: stub('GlobalSearchStub'),
          ThreadInboxPanel: stub('ThreadInboxPanelStub'),
          PinnedMessages: stub('PinnedMessagesStub'),
          StarredMessages: stub('StarredMessagesStub'),
          MemberListPanel: stub('MemberListPanelStub'),
          ChatSettingsPanel: stub('ChatSettingsPanelStub'),
          KnowledgeCapturePanel: stub('KnowledgeCapturePanelStub'),
          TaskPanel: stub('TaskPanelStub'),
          ThreadPanel: stub('ThreadPanelStub'),
          MediaViewer: stub('MediaViewerStub'),
          EmojiEffectLayer: stub('EmojiEffectLayerStub'),
        },
      },
    })

    expect(wrapper.find('[data-testid="message-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rich-text-input"]').exists()).toBe(true)

    await wrapper.get('[data-testid="tab-docs"]').trigger('click')
    expect(wrapper.find('[data-testid="chat-docs-list"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="rich-text-input"]').exists()).toBe(false)

    await wrapper.get('[data-testid="tab-files"]').trigger('click')
    expect(wrapper.find('[data-testid="chat-file-list"]').exists()).toBe(true)

    await wrapper.get('[data-testid="tab-chat"]').trigger('click')
    expect(wrapper.find('[data-testid="message-list"]').exists()).toBe(true)
  })
})
