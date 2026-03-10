import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import GlobalSearch from '@/features/chat/components/GlobalSearch.vue'
import { useRetrievalStore } from '@/features/chat/stores/retrievalStore'

const routerPush = vi.fn()
const loadInboxEventContextMock = vi.fn()
const searchRoomEventsMock = vi.fn()
const backPaginateRoomEventsSearchMock = vi.fn()

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
    searchRoomEvents: (...args: unknown[]) => searchRoomEventsMock(...args),
    backPaginateRoomEventsSearch: (...args: unknown[]) => backPaginateRoomEventsSearchMock(...args),
  }
})

function createHit(index: number, roomId = '!joined:muon.dev') {
  return {
    roomId,
    eventId: `$event-${roomId === '!joined:muon.dev' ? 'joined' : 'left'}-${index}`,
    body: `Result body ${index}`,
    sender: `@user-${index}:muon.dev`,
    ts: 1_700_000_000_000 + index,
    rank: index,
  }
}

async function flushUi() {
  await Promise.resolve()
  await nextTick()
}

describe('GlobalSearch performance', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerPush.mockReset()
    loadInboxEventContextMock.mockReset()
    searchRoomEventsMock.mockReset()
    backPaginateRoomEventsSearchMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function mountGlobalSearch() {
    return mount(GlobalSearch, {
      global: {
        stubs: {},
      },
    })
  }

  it('keeps rendered search hits bounded for large result sets and preserves joined-room filtering through pagination', async () => {
    const firstPage = [
      ...Array.from({ length: 120 }, (_, index) => createHit(index)),
      ...Array.from({ length: 30 }, (_, index) => createHit(index, '!left:muon.dev')),
    ]
    const secondPage = [
      ...Array.from({ length: 120 }, (_, index) => createHit(index + 120)),
      ...Array.from({ length: 20 }, (_, index) => createHit(index + 30, '!left:muon.dev')),
    ]

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

    const wrapper = mountGlobalSearch()
    const retrievalStore = useRetrievalStore()

    await wrapper.find('[data-testid="global-search-input"]').setValue('result')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    const firstRenderCount = wrapper.findAll('[data-testid^="global-search-hit-"]').length
    expect(firstRenderCount).toBeLessThan(80)
    expect(firstRenderCount).toBeGreaterThan(0)
    expect(wrapper.find('[data-testid="global-search-hit-$event-left-0"]').exists()).toBe(false)

    const loadMoreButton = wrapper.findAll('button').find(button => button.text() === 'chat.search_load_more')
    expect(loadMoreButton).toBeTruthy()
    await loadMoreButton!.trigger('click')
    await flushUi()

    expect(retrievalStore.results).toHaveLength(290)
    expect(retrievalStore.results.some(item => item.eventId === '$event-joined-0')).toBe(true)
    expect(retrievalStore.results.some(item => item.eventId === '$event-joined-239')).toBe(true)
    expect(wrapper.find('[data-testid="global-search-hit-$event-left-31"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid^="global-search-hit-"]').length).toBeLessThan(100)
  })

  it('continues navigation after a short preload timeout budget', async () => {
    vi.useFakeTimers()

    searchRoomEventsMock.mockResolvedValue({
      items: [createHit(1)],
      session: null,
      canPaginate: false,
    })
    loadInboxEventContextMock.mockImplementation(() => new Promise(() => {}))

    const wrapper = mountGlobalSearch()

    await wrapper.find('[data-testid="global-search-input"]').setValue('result')
    await wrapper.find('[data-testid="global-search-form"]').trigger('submit.prevent')
    await flushUi()

    await wrapper.find('[data-testid="global-search-hit-$event-joined-1"]').trigger('click')
    await vi.advanceTimersByTimeAsync(260)
    await flushUi()

    expect(routerPush).toHaveBeenCalledWith({
      path: '/dm/!joined%3Amuon.dev',
      query: {
        focusEventId: '$event-joined-1',
      },
    })
  })
})
