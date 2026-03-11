import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import ChatWindow from '@/features/chat/components/ChatWindow.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const searchRoomEventsMock = vi.fn()
const backPaginateRoomEventsSearchMock = vi.fn()
const resetStateMock = vi.fn()

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: { value: 'en' },
  }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRooms: () => [
      { roomId: '!joined:muon.dev', name: 'Joined Room', getMyMembership: () => 'join', getJoinedMemberCount: () => 2, hasEncryptionStateEvent: () => false },
      { roomId: '!left:muon.dev', name: 'Left Room', getMyMembership: () => 'leave', getJoinedMemberCount: () => 0, hasEncryptionStateEvent: () => false },
    ],
    getRoom: (roomId: string) => ({
      name: roomId === '!joined:muon.dev' ? 'Joined Room' : 'Left Room',
      getMyMembership: () => roomId === '!joined:muon.dev' ? 'join' : 'leave',
      getJoinedMemberCount: () => 2,
      hasEncryptionStateEvent: () => false,
    }),
    getAccountData: () => null,
  }),
}))

function mockGetRoom(roomId: string) {
  return {
    roomId,
    name: roomId === '!joined:muon.dev' ? 'Joined Room' : 'Left Room',
    getMyMembership: () => roomId === '!joined:muon.dev' ? 'join' : 'leave',
    getJoinedMemberCount: () => 2,
    hasEncryptionStateEvent: () => false,
  }
}

vi.mock('@matrix/rooms', () => ({
  getRoom: (roomId: string) => mockGetRoom(roomId),
  getRoomTopic: () => '',
  getRoomSummaries: () => [],
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    getRoom: (roomId: string) => mockGetRoom(roomId),
    getRoomTopic: () => '',
    sendTyping: vi.fn(),
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
    searchRoomEvents: (...args: unknown[]) => searchRoomEventsMock(...args),
    backPaginateRoomEventsSearch: (...args: unknown[]) => backPaginateRoomEventsSearchMock(...args),
  }
})

// Stubs for heavy children not related to search
const heavyStubs = {
  MessageList: { template: '<div data-testid="stub-message-list" />' },
  RichTextInput: { template: '<div data-testid="stub-rich-text-input" />' },
  TypingIndicator: { template: '<div data-testid="stub-typing-indicator" />' },
  MediaViewer: { template: '<div data-testid="stub-media-viewer" />' },
  EmojiEffectLayer: { template: '<div data-testid="stub-emoji-effect-layer" />' },
  MultiSelectBar: { template: '<div data-testid="stub-multi-select-bar" />' },
  ThreadPanel: { template: '<div data-testid="stub-thread-panel" />' },
  ThreadInboxPanel: { template: '<div data-testid="stub-thread-inbox" />' },
  PinnedMessages: { template: '<div data-testid="stub-pinned" />' },
  StarredMessages: { template: '<div data-testid="stub-starred" />' },
  MemberListPanel: { template: '<div data-testid="stub-members" />' },
  ChatSettingsPanel: { template: '<div data-testid="stub-settings" />' },
  KnowledgeCapturePanel: { template: '<div data-testid="stub-knowledge" />' },
  TaskPanel: { template: '<div data-testid="stub-tasks" />' },
  DisappearingMessageSettings: { template: '<div />' },
  Teleport: true,
  Transition: false,
}

async function flushUi() {
  await Promise.resolve()
  await nextTick()
}

describe('chatWindow search integration', () => {
  let chatStore: ReturnType<typeof useChatStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.setCurrentRoom('!joined:muon.dev')
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    searchRoomEventsMock.mockReset()
    backPaginateRoomEventsSearchMock.mockReset()
    resetStateMock.mockReset()
  })

  function mountChatWindow() {
    return mount(ChatWindow, {
      global: {
        stubs: heavyStubs,
      },
    })
  }

  it('opens real retrieval panel from header search trigger, not room-scoped SearchMessages', async () => {
    const wrapper = mountChatWindow()

    // Click the search trigger button
    const searchBtn = wrapper.find('.header-search-btn')
    expect(searchBtn.exists()).toBe(true)
    await searchBtn.trigger('click')
    await flushUi()

    // The side panel should be open
    expect(chatStore.activeSidePanel).toBe('search')

    // Should mount GlobalSearch (cross-conversation), NOT SearchMessages (room-scoped)
    // GlobalSearch has a search form with data-testid="global-search-form"
    expect(wrapper.find('[data-testid="global-search-form"]').exists()).toBe(true)
    // SearchMessages does NOT have this testid; it should not be mounted
    expect(wrapper.findComponent({ name: 'SearchMessages' }).exists()).toBe(false)
  })

  it('submits search and renders cross-conversation results with joined-room filtering', async () => {
    searchRoomEventsMock.mockResolvedValue({
      items: [
        { roomId: '!joined:muon.dev', eventId: '$hit-1', body: 'Cross-conv result', sender: '@alice:muon.dev', ts: 1700000000000, rank: 1 },
        { roomId: '!left:muon.dev', eventId: '$hit-left', body: 'Left room result', sender: '@bob:muon.dev', ts: 1700000000001, rank: 2 },
      ],
      session: { batch: 1 },
      canPaginate: true,
    })

    const wrapper = mountChatWindow()

    // Open search panel
    chatStore.toggleSidePanel('search')
    await flushUi()

    // Submit search
    const input = wrapper.find('[data-testid="global-search-input"]')
    expect(input.exists()).toBe(true)
    await input.setValue('cross-conv')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    // Joined-room result should be visible
    expect(wrapper.find('[data-testid="global-search-hit-$hit-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Cross-conv result')

    // Left-room result must NOT be visible (RETR-02)
    expect(wrapper.find('[data-testid="global-search-hit-$hit-left"]').exists()).toBe(false)
  })

  it('supports load-more pagination from the mounted search panel', async () => {
    const firstPage = Array.from({ length: 20 }, (_, i) => ({
      roomId: '!joined:muon.dev',
      eventId: `$page1-${i}`,
      body: `Page 1 result ${i}`,
      sender: '@alice:muon.dev',
      ts: 1700000000000 + i,
      rank: i,
    }))
    const secondPage = Array.from({ length: 10 }, (_, i) => ({
      roomId: '!joined:muon.dev',
      eventId: `$page2-${i}`,
      body: `Page 2 result ${i}`,
      sender: '@bob:muon.dev',
      ts: 1700000020000 + i,
      rank: 20 + i,
    }))

    searchRoomEventsMock.mockResolvedValue({
      items: firstPage,
      session: { batch: 1 },
      canPaginate: true,
    })
    backPaginateRoomEventsSearchMock.mockResolvedValue({
      items: secondPage,
      session: { batch: 2 },
      canPaginate: false,
    })

    const wrapper = mountChatWindow()

    chatStore.toggleSidePanel('search')
    await flushUi()

    await wrapper.find('[data-testid="global-search-input"]').setValue('paginate')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    // First page results rendered
    expect(wrapper.find('[data-testid="global-search-hit-$page1-0"]').exists()).toBe(true)

    // Load more button should be present
    const loadMoreBtn = wrapper.findAll('button').find(b => b.text() === 'chat.search_load_more')
    expect(loadMoreBtn).toBeTruthy()
    await loadMoreBtn!.trigger('click')
    await flushUi()

    // Second page results should also be rendered
    expect(wrapper.find('[data-testid="global-search-hit-$page2-0"]').exists()).toBe(true)
  })

  it('jumps to result using canonical /dm navigation with focusEventId', async () => {
    searchRoomEventsMock.mockResolvedValue({
      items: [
        { roomId: '!joined:muon.dev', eventId: '$jump-target', body: 'Jump here', sender: '@alice:muon.dev', ts: 1700000000000, rank: 1 },
      ],
      session: null,
      canPaginate: false,
    })
    loadInboxEventContextMock.mockResolvedValue({})

    const wrapper = mountChatWindow()

    chatStore.toggleSidePanel('search')
    await flushUi()

    await wrapper.find('[data-testid="global-search-input"]').setValue('jump')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    await wrapper.find('[data-testid="global-search-hit-$jump-target"]').trigger('click')
    await flushUi()

    // Must use canonical /dm path, NOT legacy /chat path
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: { focusEventId: '$jump-target' },
    })

    // Preload should have been called before navigation
    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!joined:muon.dev', '$jump-target')
    expect(loadInboxEventContextMock.mock.invocationCallOrder[0]).toBeLessThan(routerPush.mock.invocationCallOrder[0])
  })

  it('closes cleanly and reopening does not show stale results', async () => {
    searchRoomEventsMock.mockResolvedValue({
      items: [
        { roomId: '!joined:muon.dev', eventId: '$stale', body: 'Stale result', sender: '@alice:muon.dev', ts: 1700000000000, rank: 1 },
      ],
      session: null,
      canPaginate: false,
    })

    const wrapper = mountChatWindow()

    // Open and search
    chatStore.toggleSidePanel('search')
    await flushUi()
    await wrapper.find('[data-testid="global-search-input"]').setValue('stale')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    expect(wrapper.find('[data-testid="global-search-hit-$stale"]').exists()).toBe(true)

    // Close search panel
    chatStore.closeSidePanel()
    await flushUi()

    expect(chatStore.activeSidePanel).toBeNull()

    // Reopen - should NOT show stale results
    chatStore.toggleSidePanel('search')
    await flushUi()

    expect(wrapper.find('[data-testid="global-search-hit-$stale"]').exists()).toBe(false)
  })
})
