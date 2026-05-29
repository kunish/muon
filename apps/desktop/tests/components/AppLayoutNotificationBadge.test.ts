import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AppLayout from '@/app/components/AppLayout.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

const totalUnreadCount = vi.hoisted(() => ({
  __v_isRef: true,
  value: 8,
}))
const myDisplayName = vi.hoisted(() => vi.fn(() => 'Ada Chen'))
const push = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  fullPath: '/dm',
  params: {},
  path: '/dm',
}))
const serverStore = vi.hoisted(() => ({
  currentServerId: null as string | null,
  loadServers: vi.fn(),
  selectChannel: vi.fn(),
  selectServer: vi.fn(),
  startListening: vi.fn(),
  stopListening: vi.fn(),
}))

vi.mock('@features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    totalUnreadCount,
  }),
}))

vi.mock('@features/server/stores/serverStore', () => ({
  useServerStore: () => serverStore,
}))

vi.mock('@features/settings/composables/useTheme', () => ({
  useTheme: vi.fn(),
}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    leave: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@matrix/index', () => ({
  getMyDisplayName: myDisplayName,
}))

vi.mock('vue-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('vue-router')>()),
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

const WorkspaceLayoutStub = {
  props: {
    messageUnreadCount: {
      default: 0,
      type: Number,
    },
  },
  template: `
    <section
      data-testid="workspace-layout"
      :data-message-unread-count="messageUnreadCount"
    >
      <slot name="message-sidebar" />
      <slot />
      <slot name="overlays" />
    </section>
  `,
}

const WatermarkOverlayStub = {
  props: {
    text: {
      default: '',
      type: String,
    },
  },
  template: '<div data-testid="watermark-overlay" :data-text="text" />',
}

const ChannelSidebarStub = {
  template: '<aside data-testid="channel-sidebar-stub" />',
}

function mountAppLayout() {
  return mount(AppLayout, {
    global: {
      stubs: {
        CallOverlay: true,
        ChannelSidebar: ChannelSidebarStub,
        CreateCategoryDialog: true,
        Dialog: true,
        DialogContent: true,
        DialogDescription: true,
        DialogHeader: true,
        DialogTitle: true,
        GlobalOverlayHost: true,
        InviteDialog: true,
        NetworkStatusBar: true,
        RouterView: true,
        ServerSettings: true,
        WatermarkOverlay: WatermarkOverlayStub,
        WorkspaceLayout: WorkspaceLayoutStub,
      },
    },
  })
}

describe('app layout notification badges', () => {
  beforeEach(() => {
    localStorage.clear()
    totalUnreadCount.value = 8
    route.fullPath = '/dm'
    route.params = {}
    route.path = '/dm'
    serverStore.currentServerId = null
    serverStore.loadServers.mockClear()
    serverStore.selectChannel.mockClear()
    serverStore.selectServer.mockClear()
    serverStore.startListening.mockClear()
    serverStore.stopListening.mockClear()
    myDisplayName.mockReturnValue('Ada Chen')
    push.mockClear()
  })

  it('passes zero unread count to the app rail when badge count is disabled', async () => {
    const settingsStore = useSettingsStore()
    settingsStore.badgeCount = false

    const wrapper = mountAppLayout()

    expect(wrapper.get('[data-testid="workspace-layout"]').attributes('data-message-unread-count')).toBe('0')

    settingsStore.badgeCount = true
    await nextTick()

    expect(wrapper.get('[data-testid="workspace-layout"]').attributes('data-message-unread-count')).toBe('8')
  })

  it('uses the current Matrix display name in the security watermark', () => {
    const settingsStore = useSettingsStore()
    settingsStore.watermarkEnabled = true

    const wrapper = mountAppLayout()

    const watermarkText = wrapper.get('[data-testid="watermark-overlay"]').attributes('data-text') ?? ''
    expect(watermarkText).toContain('Ada Chen')
    expect(watermarkText).not.toContain('User')
  })

  it('keeps the message sidebar mounted while non-message routes are active', () => {
    route.fullPath = '/contacts'
    route.path = '/contacts'

    const wrapper = mountAppLayout()
    const sidebar = wrapper.get('[data-testid="channel-sidebar-stub"]')

    expect(sidebar.attributes('style')).toContain('display: none')
  })
})
