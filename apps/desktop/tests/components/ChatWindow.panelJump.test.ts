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

const focusEventSpy = vi.hoisted(() => vi.fn())

function stub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

// MessageList stub that exposes focusEvent so ChatWindow's template ref can call it.
const MessageListStub = defineComponent({
  name: 'MessageListStub',
  setup(_, { expose }) {
    expose({ focusEvent: focusEventSpy })
    return () => h('div', { 'data-testid': 'stub-message-list' })
  },
})

const PinnedMessagesStub = defineComponent({
  name: 'PinnedMessagesStub',
  emits: ['jumpTo', 'close'],
  setup() {
    return () => h('div', { 'data-testid': 'stub-pinned' })
  },
})

const stubs = {
  ChatHeader: stub('ChatHeaderStub', 'stub-chat-header'),
  MessageList: MessageListStub,
  RichTextInput: stub('RichTextInputStub', 'stub-rich-text-input'),
  ChatDocsList: stub('ChatDocsListStub', 'stub-chat-docs'),
  ChatFileList: stub('ChatFileListStub', 'stub-chat-files'),
  TypingIndicator: stub('TypingIndicatorStub', 'stub-typing-indicator'),
  MultiSelectBar: stub('MultiSelectBarStub', 'stub-multi-select-bar'),
  GlobalSearch: stub('GlobalSearchStub', 'stub-search'),
  ThreadInboxPanel: stub('ThreadInboxPanelStub', 'stub-thread-inbox'),
  PinnedMessages: PinnedMessagesStub,
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

describe('chatWindow panel jump-to', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useChatStore().setCurrentRoom('!room:muon.dev')
    focusEventSpy.mockClear()
  })

  it('focuses the timeline message when a pinned message is clicked', async () => {
    const store = useChatStore()
    const wrapper = mount(ChatWindow, { global: { stubs } })

    store.toggleSidePanel('pinned')
    await flushUi()

    const pinned = wrapper.findComponent({ name: 'PinnedMessagesStub' })
    expect(pinned.exists()).toBe(true)
    pinned.vm.$emit('jumpTo', '$pinned-event')
    await flushUi()

    expect(focusEventSpy).toHaveBeenCalledWith('$pinned-event')
  })
})
