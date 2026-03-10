import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { computed, defineComponent, h, reactive, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routerPush, loadInboxEventContext } = vi.hoisted(() => ({
  routerPush: vi.fn(),
  loadInboxEventContext: vi.fn(),
}))

const serverStore = reactive({
  channelTree: [],
  isDmMode: true,
  currentServerId: null as string | null,
  servers: [],
})

function createStub(name: string, testId = name) {
  return defineComponent({
    name,
    setup() {
      return () => h('div', { 'data-testid': testId }, name)
    },
  })
}

function createScrollAreaStub() {
  return defineComponent({
    name: 'ScrollAreaStub',
    setup(_, { slots }) {
      return () => h('div', { 'data-testid': 'scroll-area' }, slots.default?.())
    },
  })
}

function createInputStub() {
  return defineComponent({
    name: 'InputStub',
    props: {
      modelValue: {
        type: String,
        default: '',
      },
    },
    emits: ['update:modelValue'],
    setup(props, { emit, attrs }) {
      return () => h('input', {
        ...attrs,
        value: props.modelValue,
        onInput: (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value),
      })
    },
  })
}

function createServerDropdownStub() {
  return defineComponent({
    name: 'ServerDropdownStub',
    setup(_, { slots }) {
      return () => h('div', [slots.trigger?.({ open: false }), slots.default?.()])
    },
  })
}

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

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getUserId: () => '@tester:example.org',
    getUser: () => ({ presence: 'online' }),
  }),
}))

vi.mock('@matrix/index', () => ({
  getMyAvatarUrl: () => '',
  getMyDisplayName: () => 'Tester',
  loadInboxEventContext,
}))

vi.mock('lucide-vue-next', () => {
  const icon = createStub('Icon', 'icon')
  return {
    BookOpen: icon,
    CalendarDays: icon,
    ChevronDown: icon,
    Gem: icon,
    Headphones: icon,
    ListChecks: icon,
    Mic: icon,
    MicOff: icon,
    Search: icon,
    Settings: icon,
    Users: icon,
    X: icon,
  }
})

vi.mock('@/features/server/stores/serverStore', () => ({
  useServerStore: () => serverStore,
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    conversations: computed(() => []),
  }),
}))

vi.mock('@/features/server/composables/useVoiceChannel', () => ({
  useVoiceChannel: () => ({
    isMuted: ref(false),
    isDeafened: ref(false),
    toggleMute: vi.fn(),
    toggleDeafen: vi.fn(),
  }),
}))

vi.mock('@/features/chat/composables/useTyping', () => ({
  useTyping: () => ({
    typingUsers: ref([]),
  }),
}))

vi.mock('../../src/features/chat/composables/useTyping', () => ({
  useTyping: () => ({
    typingUsers: ref([]),
  }),
}))

vi.mock('@/features/chat/components/OfflineDigestPanel.vue', () => ({
  default: createStub('OfflineDigestPanelStub', 'offline-digest-panel'),
}))

vi.mock('@/features/chat/components/DecisionPanel.vue', () => ({
  default: createStub('DecisionPanelStub', 'decision-panel'),
}))

vi.mock('@/features/chat/components/CrossSessionQaPanel.vue', () => ({
  default: createStub('CrossSessionQaPanelStub', 'cross-session-qa-panel'),
}))

vi.mock('@/features/chat/components/ChatHeader.vue', () => ({ default: createStub('ChatHeaderStub') }))
vi.mock('@/features/chat/components/ChatSettingsPanel.vue', () => ({ default: createStub('ChatSettingsPanelStub') }))
vi.mock('@/features/chat/components/EmojiEffectLayer.vue', () => ({ default: createStub('EmojiEffectLayerStub') }))
vi.mock('@/features/chat/components/MediaViewer.vue', () => ({ default: createStub('MediaViewerStub') }))
vi.mock('@/features/chat/components/MemberListPanel.vue', () => ({ default: createStub('MemberListPanelStub') }))
vi.mock('@/features/chat/components/MessageList.vue', () => ({ default: createStub('MessageListStub') }))
vi.mock('@/features/chat/components/MultiSelectBar.vue', () => ({ default: createStub('MultiSelectBarStub') }))
vi.mock('@/features/chat/components/PinnedMessages.vue', () => ({ default: createStub('PinnedMessagesStub') }))
vi.mock('@/features/chat/components/RichTextInput.vue', () => ({ default: createStub('RichTextInputStub') }))
vi.mock('@/features/chat/components/GlobalSearch.vue', () => ({ default: createStub('GlobalSearchStub') }))
vi.mock('@/features/chat/components/StarredMessages.vue', () => ({ default: createStub('StarredMessagesStub') }))
vi.mock('@/features/chat/components/TaskPanel.vue', () => ({ default: createStub('TaskPanelStub', 'task-panel') }))
vi.mock('@/features/chat/components/ThreadInboxPanel.vue', () => ({ default: createStub('ThreadInboxPanelStub') }))
vi.mock('@/features/chat/components/ThreadPanel.vue', () => ({ default: createStub('ThreadPanelStub') }))
vi.mock('@/features/chat/components/TypingIndicator.vue', () => ({ default: createStub('TypingIndicatorStub') }))
vi.mock('@/features/chat/components/UnifiedInboxPanel.vue', () => ({ default: createStub('UnifiedInboxPanelStub') }))
vi.mock('@/features/chat/components/DeferQueuePanel.vue', () => ({ default: createStub('DeferQueuePanelStub') }))
vi.mock('@/features/server/components/ChannelCategory.vue', () => ({ default: createStub('ChannelCategoryStub') }))
vi.mock('@/features/server/components/ChannelContextMenu.vue', () => ({ default: createStub('ChannelContextMenuStub') }))
vi.mock('@/features/server/components/CreateChannelDialog.vue', () => ({ default: createStub('CreateChannelDialogStub') }))
vi.mock('@/features/server/components/ServerDropdown.vue', () => ({ default: createServerDropdownStub() }))
vi.mock('@/features/server/components/TextChannelItem.vue', () => ({ default: createStub('TextChannelItemStub') }))
vi.mock('@/features/server/components/VoiceChannelItem.vue', () => ({ default: createStub('VoiceChannelItemStub') }))
vi.mock('@/features/server/components/VoiceStatusBar.vue', () => ({ default: createStub('VoiceStatusBarStub') }))
vi.mock('@/shared/components/ui/avatar', () => ({ Avatar: createStub('AvatarStub') }))
vi.mock('@/shared/components/ui/badge', () => ({ Badge: createStub('BadgeStub') }))
vi.mock('@/shared/components/ui/input', () => ({ Input: createInputStub() }))
vi.mock('@/shared/components/ui/scroll-area', () => ({ ScrollArea: createScrollAreaStub() }))

import ChannelSidebar from '../../src/features/server/components/ChannelSidebar.vue'
import ChatWindow from '../../src/features/chat/components/ChatWindow.vue'
import KnowledgeCapturePanel from '../../src/features/chat/components/KnowledgeCapturePanel.vue'
import { useChatStore } from '../../src/features/chat/stores/chatStore'

let pinia: ReturnType<typeof createPinia>

describe('KnowledgeCapturePanel integration', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const chatStore = useChatStore()
    chatStore.currentRoomId = '!room:example.org'
    chatStore.activeSidePanel = null
    chatStore.multiSelectMode = false
    chatStore.activeThreadId = null
    serverStore.isDmMode = true
    routerPush.mockReset()
    loadInboxEventContext.mockReset()
  })

  afterEach(() => {
    const chatStore = useChatStore()
    chatStore.currentRoomId = null
    chatStore.activeSidePanel = null
  })

  it('renders digest/decision/qa as an accessible tabbed knowledge shell', async () => {
    const wrapper = mount(KnowledgeCapturePanel)

    const digestTab = wrapper.get('[data-testid="knowledge-tab-digest"]')
    expect(digestTab.attributes('role')).toBe('tab')
    expect(digestTab.attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="knowledge-panel-digest"]').attributes('role')).toBe('tabpanel')
    expect(wrapper.get('[data-testid="offline-digest-panel"]')).toBeTruthy()

    await wrapper.get('[data-testid="knowledge-tab-decision"]').trigger('click')
    expect(wrapper.get('[data-testid="knowledge-tab-decision"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="decision-panel"]')).toBeTruthy()

    await wrapper.get('[data-testid="knowledge-tab-qa"]').trigger('click')
    expect(wrapper.get('[data-testid="knowledge-tab-qa"]').attributes('aria-selected')).toBe('true')
    expect(wrapper.get('[data-testid="cross-session-qa-panel"]')).toBeTruthy()
  })

  it('mounts the knowledge panel through the existing chat side-panel slot without conflicting with other panels', () => {
    const chatStore = useChatStore()
    chatStore.activeSidePanel = 'knowledge'
    const knowledgeWrapper = mount(ChatWindow, { global: { plugins: [pinia] } })
    expect(knowledgeWrapper.get('[data-testid="knowledge-capture-panel"]')).toBeTruthy()
    expect(knowledgeWrapper.find('[data-testid="task-panel"]').exists()).toBe(false)

    chatStore.activeSidePanel = 'tasks'
    const taskWrapper = mount(ChatWindow, { global: { plugins: [pinia] } })
    expect(taskWrapper.get('[data-testid="task-panel"]')).toBeTruthy()
    expect(taskWrapper.find('[data-testid="knowledge-capture-panel"]').exists()).toBe(false)
  })

  it('uses the DM sidebar knowledge trigger to toggle the shared side-panel instead of routing away', async () => {
    const chatStore = useChatStore()
    const toggleSpy = vi.spyOn(chatStore, 'toggleSidePanel')
    const wrapper = mount(ChannelSidebar, { global: { plugins: [pinia] } })
    const trigger = wrapper.get('[data-testid="knowledge-panel-trigger"]')

    expect(trigger.attributes('aria-pressed')).toBe('false')

    await trigger.trigger('click')

    expect(toggleSpy).toHaveBeenCalledWith('knowledge')
    expect(chatStore.activeSidePanel).toBe('knowledge')
    expect(routerPush).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="knowledge-panel-trigger"]').attributes('aria-pressed')).toBe('true')
  })
})
