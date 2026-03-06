import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import GlobalSearch from '@/features/chat/components/GlobalSearch.vue'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const searchMock = vi.fn()
const loadMoreMock = vi.fn()

const retrievalState = reactive({
  query: '',
  loading: false,
  loadingMore: false,
  error: null as string | null,
  hasSearched: false,
  canLoadMore: false,
  results: [] as Array<{
    roomId: string
    eventId: string
    body: string
    sender: string
    ts: number
    rank: number
  }>,
})

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
    loadInboxEventContext: (...args: unknown[]) => loadInboxEventContextMock(...args),
  }
})

vi.mock('@/features/chat/stores/retrievalStore', () => ({
  useRetrievalStore: () => ({
    ...retrievalState,
    search: (...args: unknown[]) => searchMock(...args),
    loadMore: (...args: unknown[]) => loadMoreMock(...args),
  }),
}))

describe('GlobalSearch', () => {
  function mountGlobalSearch() {
    return mount(GlobalSearch, {
      global: {
        stubs: {
          Teleport: true,
        },
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
    searchMock.mockReset()
    loadMoreMock.mockReset()
    retrievalState.query = ''
    retrievalState.loading = false
    retrievalState.loadingMore = false
    retrievalState.error = null
    retrievalState.hasSearched = false
    retrievalState.canLoadMore = false
    retrievalState.results = []
  })

  it('renders cross-conversation message results after search submit', async () => {
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

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('result')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')

    expect(searchMock).toHaveBeenCalledWith('result')
    expect(wrapper.find('[data-testid="global-search-hit-$event-1"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('@alice:muon.dev')
    expect(wrapper.text()).toContain('Result body')
    expect(wrapper.text()).toContain('Joined Room')
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
      path: '/chat/!joined%3Amuon.dev',
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
      path: '/chat/!joined%3Amuon.dev',
      query: {
        focusEventId: '$event-1',
      },
    })
    expect(wrapper.emitted('close')).toBeTruthy()
    warnSpy.mockRestore()
  })
})
