import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import {
  chatStore,
  enterMultiSelect,
  resetChatStore,
  setCurrentRoom,
  toggleMessageSelection,
} from '@/features/chat/stores/chatStore'

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({ typingUsers: [] }),
}))

vi.mock('@/desktop/dialog', () => ({ ask: vi.fn() }))

function stub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

const MultiSelectBarStub = defineComponent({
  name: 'MultiSelectBarStub',
  emits: ['forward'],
  setup() {
    return () => h('div', { 'data-testid': 'stub-multi-select-bar' })
  },
})

const ForwardDialogStub = defineComponent({
  name: 'ForwardDialogStub',
  emits: ['close'],
  setup() {
    return () => h('div', { 'data-testid': 'stub-forward-dialog' })
  },
})

const stubs = {
  ChatHeader: stub('ChatHeaderStub', 'stub-chat-header'),
  MessageList: stub('MessageListStub', 'stub-message-list'),
  RichTextInput: stub('RichTextInputStub', 'stub-rich-text-input'),
  ChatDocsList: stub('ChatDocsListStub', 'stub-chat-docs'),
  ChatFileList: stub('ChatFileListStub', 'stub-chat-files'),
  TypingIndicator: stub('TypingIndicatorStub', 'stub-typing-indicator'),
  MultiSelectBar: MultiSelectBarStub,
  ForwardDialog: ForwardDialogStub,
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

describe('chatWindow merged forward', () => {
  beforeEach(() => {
    resetChatStore()
    setCurrentRoom('!room:muon.dev')
    enterMultiSelect()
    toggleMessageSelection('$e1')
    toggleMessageSelection('$e2')
  })

  it('opens the forward dialog when multi-select forward is triggered', async () => {
    const wrapper = mount(ChatWindow, { global: { stubs } })

    expect(wrapper.findComponent({ name: 'ForwardDialogStub' }).exists()).toBe(false)

    wrapper.findComponent({ name: 'MultiSelectBarStub' }).vm.$emit('forward')
    await nextTick()

    expect(wrapper.findComponent({ name: 'ForwardDialogStub' }).exists()).toBe(true)
  })

  it('closing the forward dialog exits multi-select mode', async () => {
    const wrapper = mount(ChatWindow, { global: { stubs } })

    wrapper.findComponent({ name: 'MultiSelectBarStub' }).vm.$emit('forward')
    await nextTick()
    wrapper.findComponent({ name: 'ForwardDialogStub' }).vm.$emit('close')
    await nextTick()

    expect(chatStore.state.multiSelectMode).toBe(false)
    expect(wrapper.findComponent({ name: 'ForwardDialogStub' }).exists()).toBe(false)
  })
})
