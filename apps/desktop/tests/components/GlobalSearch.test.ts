import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { addAnnouncement, resetAnnouncementStore } from '@/features/announcements/stores/announcementStore'
import { addEvent as addCalendarEvent, resetCalendarStore } from '@/features/calendar/stores/calendarStore'
import GlobalSearch from '@/features/chat/components/GlobalSearch.vue'
import {
  chatStore,
  clearSidebarPromotions,
  getSidebarPromotionTime,
  resetChatStore,
  setFilter,
  setSearchQuery,
} from '@/features/chat/stores/chatStore'
import { resetRetrievalStore, retrievalStore } from '@/features/chat/stores/retrievalStore'
import { resetContactStore } from '@/features/contacts/stores/contactStore'
import { addMap, resetMindmapStore } from '@/features/mindmap/stores/mindmapStore'
import { addObjective, resetOkrStore } from '@/features/okr/stores/okrStore'
import { currentPeriod } from '@/features/okr/types/okr'

const contactsSeed = vi.hoisted(() => ({ contacts: [] as any[], groups: [] as any[] }))
vi.mock('@/features/contacts/queries/useContacts', () => ({
  useContactsQuery: () => ({
    contacts: {
      get value() {
        return contactsSeed.contacts
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
  useGroupsQuery: () => ({
    groups: {
      get value() {
        return contactsSeed.groups
      },
    },
    refetch: vi.fn().mockResolvedValue(undefined),
  }),
}))

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const findOrCreateDmMock = vi.fn()
const searchMock = vi.fn()
const loadMoreMock = vi.fn()
const localeMock = vi.hoisted(() => ({
  value: 'en',
}))
const NOVEMBER_15_NOON_UTC = Date.UTC(2023, 10, 15, 12, 13)

// Seeds write through to the real retrieval vue-store so the component's
// useSelector reflects them; the search/loadMore/resetState actions are mocked below.
const retrievalState = new Proxy({} as Record<string, unknown>, {
  set(_target, key, value) {
    retrievalStore.setState((prev) => ({ ...prev, [key]: value }))
    return true
  },
})

vi.mock('vue-i18n', () => ({
  createI18n: () => ({
    global: { t: (key: string) => key },
    install: vi.fn(),
  }),
  useI18n: () => ({
    t: (key: string) => key,
    locale: localeMock,
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
      { roomId: '!joined:muon.dev', name: 'Joined Room', getMyMembership: () => 'join' },
      { roomId: '!left:muon.dev', name: 'Left Room', getMyMembership: () => 'leave' },
    ],
    getRoom: (roomId: string) => ({ name: roomId === '!joined:muon.dev' ? 'Joined Room' : 'Left Room' }),
  }),
}))

vi.mock('@matrix/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@matrix/index')>()
  return {
    ...actual,
    findOrCreateDm: (...args: unknown[]) => findOrCreateDmMock(...args),
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
  }
})

const resetStateMock = vi.fn()

vi.mock('@/features/chat/stores/retrievalStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/chat/stores/retrievalStore')>()),
  search: (...args: unknown[]) => searchMock(...args),
  loadMore: (...args: unknown[]) => loadMoreMock(...args),
  resetState: (...args: unknown[]) => resetStateMock(...args),
}))

describe('globalSearch', () => {
  function mountGlobalSearch() {
    return mount(GlobalSearch, {
      global: {
        stubs: {},
      },
    })
  }

  async function flushUi() {
    await Promise.resolve()
    await Promise.resolve()
  }

  beforeEach(() => {
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    findOrCreateDmMock.mockReset()
    searchMock.mockReset()
    loadMoreMock.mockReset()
    resetStateMock.mockReset()
    resetRetrievalStore()
    localeMock.value = 'en'
    resetChatStore()
    clearSidebarPromotions()
    setFilter('all')
    setSearchQuery('')
    resetContactStore()
    contactsSeed.contacts = []
    contactsSeed.groups = []
  })

  it('resets native input chrome in the search header', () => {
    const wrapper = mountGlobalSearch()
    const input = wrapper.get('[data-testid="global-search-input"]')
    const submit = wrapper.get('[data-testid="global-search-form"] button[type="submit"]')

    expect(input.classes()).toContain('border-0')
    expect(input.classes()).toContain('focus:ring-0')
    expect(input.classes()).toContain('focus:ring-offset-0')
    expect(input.classes()).toContain('focus-visible:ring-0')
    expect(input.classes()).toContain('focus-visible:ring-offset-0')
    expect(submit.classes()).toContain('h-8')
  })

  it('shows recent searches on empty query and re-runs one on click', async () => {
    localStorage.clear()
    localStorage.setItem('muon_search_history', JSON.stringify(['alpha', 'beta']))
    const wrapper = mountGlobalSearch()
    await flushUi()

    expect(wrapper.find('[data-testid="search-recent"]').exists()).toBe(true)
    const terms = wrapper.findAll('[data-testid="search-recent-term"]')
    expect(terms.map((node) => node.text())).toEqual(['alpha', 'beta'])

    await terms[0].trigger('click')
    expect(searchMock).toHaveBeenCalledWith('alpha')

    localStorage.clear()
  })

  it('records the submitted term into recent searches', async () => {
    localStorage.clear()
    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('reportq')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    expect(JSON.parse(localStorage.getItem('muon_search_history') ?? '[]')).toContain('reportq')
    localStorage.clear()
  })

  it('renders cross-conversation message results after search submit', async () => {
    retrievalState.results = [
      {
        roomId: '!joined:muon.dev',
        eventId: '$event-1',
        body: 'Result body',
        sender: '@alice:muon.dev',
        ts: NOVEMBER_15_NOON_UTC,
        rank: 1,
      },
    ]
    retrievalState.hasSearched = true

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('result')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')

    expect(searchMock).toHaveBeenCalledWith('result')
    expect(wrapper.find('[data-testid="global-search-hit-$event-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('@alice:muon.dev')
    expect(wrapper.text()).toContain('Result body')
    expect(wrapper.text()).toContain('Joined Room')
  })

  it('formats message result timestamps with the active locale', () => {
    localeMock.value = 'zh'
    retrievalState.results = [
      {
        roomId: '!joined:muon.dev',
        eventId: '$event-1',
        body: 'Result body',
        sender: '@alice:muon.dev',
        ts: NOVEMBER_15_NOON_UTC,
        rank: 1,
      },
    ]
    retrievalState.hasSearched = true

    const wrapper = mountGlobalSearch()

    expect(wrapper.text()).toContain('11月15日')
    expect(wrapper.text()).not.toContain('Nov 15')
  })

  it('excludes left-room results from rendering', async () => {
    retrievalState.results = [
      {
        roomId: '!left:muon.dev',
        eventId: '$left-event',
        body: 'Left room message',
        sender: '@bob:muon.dev',
        ts: 1700000000000,
        rank: 2,
      },
    ]
    retrievalState.hasSearched = true

    const wrapper = mountGlobalSearch()

    expect(wrapper.find('[data-testid="global-search-hit-$left-event"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Left room message')
  })

  it('jump to result: preloads context before navigating with focusEventId', async () => {
    retrievalState.results = [
      {
        roomId: '!joined:muon.dev',
        eventId: '$event-1',
        body: 'Result body',
        sender: '@alice:muon.dev',
        ts: 1700000000000,
        rank: 1,
      },
    ]
    retrievalState.hasSearched = true
    loadInboxEventContextMock.mockResolvedValue({})

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-hit-$event-1"]').trigger('click')
    await flushUi()

    expect(loadInboxEventContextMock).toHaveBeenCalledWith('!joined:muon.dev', '$event-1')
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: {
        focusEventId: '$event-1',
      },
    })
    expect(loadInboxEventContextMock.mock.invocationCallOrder[0]).toBeLessThan(routerPush.mock.invocationCallOrder[0])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('falls back to navigation when context preload fails and warns', async () => {
    retrievalState.results = [
      {
        roomId: '!joined:muon.dev',
        eventId: '$event-1',
        body: 'Result body',
        sender: '@alice:muon.dev',
        ts: 1700000000000,
        rank: 1,
      },
    ]
    retrievalState.hasSearched = true
    loadInboxEventContextMock.mockRejectedValue(new Error('network error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-hit-$event-1"]').trigger('click')
    await flushUi()

    expect(warnSpy).toHaveBeenCalled()
    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: {
        focusEventId: '$event-1',
      },
    })
    expect(wrapper.emitted('close')).toBeTruthy()
    warnSpy.mockRestore()
  })

  it('promotes a conversation opened from a room search result', async () => {
    setFilter('unread')
    setSearchQuery('joined')

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('joined')
    await wrapper.find('[data-testid="global-search-room-!joined:muon.dev"]').trigger('click')
    await flushUi()

    expect(routerPush).toHaveBeenCalledWith('/dm/!joined%3Amuon.dev')
    expect(getSidebarPromotionTime('!joined:muon.dev')).toEqual(expect.any(Number))
    expect(chatStore.state.activeFilter).toBe('all')
    expect(chatStore.state.searchQuery).toBe('')
  })

  it('promotes a direct conversation opened from a contact result', async () => {
    contactsSeed.contacts = [
      {
        userId: '@bob:muon.dev',
        displayName: 'Bob',
        presence: 'offline',
      },
    ]
    findOrCreateDmMock.mockResolvedValue('!bob:muon.dev')

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('bob')
    await wrapper.find('[data-testid="global-search-contact-@bob:muon.dev"]').trigger('click')
    await flushUi()

    expect(findOrCreateDmMock).toHaveBeenCalledWith('@bob:muon.dev')
    expect(routerPush).toHaveBeenCalledWith('/dm/!bob%3Amuon.dev')
    expect(getSidebarPromotionTime('!bob:muon.dev')).toEqual(expect.any(Number))
  })

  it('surfaces matching workspace content from feature modules and navigates to it', async () => {
    resetOkrStore()
    addObjective({ id: 'okr-search-1', period: currentPeriod(Date.now()), title: 'Zephyr 北极星目标' })

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('Zephyr')
    await flushUi()

    expect(wrapper.find('[data-testid="global-search-content-okr:okr-search-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Zephyr 北极星目标')

    await wrapper.find('[data-testid="global-search-content-okr:okr-search-1"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ path: '/okr', query: { focus: 'okr-search-1' } })

    resetOkrStore()
  })

  it('finds a calendar event by title in workspace content search', async () => {
    resetCalendarStore()
    addCalendarEvent({
      id: 'evt-search-1',
      title: 'Quasar 季度复盘会',
      date: '2026-06-09',
      time: '09:00',
      participants: '我',
    })

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('Quasar')
    await flushUi()

    expect(wrapper.find('[data-testid="global-search-content-event:evt-search-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Quasar 季度复盘会')

    await wrapper.find('[data-testid="global-search-content-event:evt-search-1"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ path: '/calendar', query: { focus: 'evt-search-1' } })

    resetCalendarStore()
  })

  it('finds an announcement by title and deep-links to it', async () => {
    resetAnnouncementStore()
    addAnnouncement({ id: 'ann-search-1', title: 'Halley 年度全员会通知', body: '' })

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('Halley')
    await flushUi()

    expect(wrapper.find('[data-testid="global-search-content-announcement:ann-search-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Halley 年度全员会通知')

    await wrapper.find('[data-testid="global-search-content-announcement:ann-search-1"]').trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ path: '/announcements', query: { focus: 'ann-search-1' } })

    resetAnnouncementStore()
  })

  it('finds a mindmap by title and deep-links to it', async () => {
    resetMindmapStore()
    const map = addMap('Quark 产品脑图')

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('Quark')
    await flushUi()

    expect(wrapper.find(`[data-testid="global-search-content-mindmap:${map.id}"]`).exists()).toBe(true)
    expect(wrapper.text()).toContain('Quark 产品脑图')

    await wrapper.find(`[data-testid="global-search-content-mindmap:${map.id}"]`).trigger('click')
    expect(routerPush).toHaveBeenCalledWith({ path: '/mindmap', query: { focus: map.id } })

    resetMindmapStore()
  })
})
