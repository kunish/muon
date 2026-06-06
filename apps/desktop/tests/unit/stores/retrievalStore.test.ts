import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadMore,
  resetRetrievalStore,
  resetState,
  retrievalStore,
  search,
} from '@/features/chat/stores/retrievalStore'

const searchRoomEventsMock = vi.fn()
const backPaginateRoomEventsSearchMock = vi.fn()

vi.mock('@matrix/index', () => ({
  searchRoomEvents: (...args: unknown[]) => searchRoomEventsMock(...args),
  backPaginateRoomEventsSearch: (...args: unknown[]) => backPaginateRoomEventsSearchMock(...args),
}))

function hit(eventId: string, roomId = '!room:muon.dev') {
  return { eventId, roomId, sender: '@a:muon.dev', body: eventId, ts: 1 }
}

beforeEach(() => {
  searchRoomEventsMock.mockReset()
  backPaginateRoomEventsSearchMock.mockReset()
  resetRetrievalStore()
})

describe('retrievalStore', () => {
  it('starts empty', () => {
    expect(retrievalStore.state).toMatchObject({
      query: '',
      results: [],
      loading: false,
      hasSearched: false,
      error: null,
      canLoadMore: false,
      session: null,
    })
  })

  it('search populates results, session and canLoadMore and clears loading', async () => {
    searchRoomEventsMock.mockResolvedValue({ items: [hit('$a'), hit('$b')], session: { batch: 1 }, canPaginate: true })

    await search('hello')

    expect(searchRoomEventsMock).toHaveBeenCalledWith('hello')
    expect(retrievalStore.state.results.map((r) => r.eventId)).toEqual(['$a', '$b'])
    expect(retrievalStore.state.session).toEqual({ batch: 1 })
    expect(retrievalStore.state.canLoadMore).toBe(true)
    expect(retrievalStore.state.hasSearched).toBe(true)
    expect(retrievalStore.state.loading).toBe(false)
    expect(retrievalStore.state.query).toBe('hello')
  })

  it('search with a blank query resets without hitting matrix', async () => {
    await search('   ')

    expect(searchRoomEventsMock).not.toHaveBeenCalled()
    expect(retrievalStore.state.hasSearched).toBe(false)
    expect(retrievalStore.state.results).toEqual([])
    expect(retrievalStore.state.query).toBe('   ')
  })

  it('search surfaces the error message and clears results on failure', async () => {
    searchRoomEventsMock.mockRejectedValue(new Error('search backend down'))

    await search('boom')

    expect(retrievalStore.state.error).toBe('search backend down')
    expect(retrievalStore.state.results).toEqual([])
    expect(retrievalStore.state.canLoadMore).toBe(false)
    expect(retrievalStore.state.loading).toBe(false)
  })

  it('loadMore appends de-duplicated results and advances the session', async () => {
    searchRoomEventsMock.mockResolvedValue({ items: [hit('$a'), hit('$b')], session: { batch: 1 }, canPaginate: true })
    await search('hello')

    backPaginateRoomEventsSearchMock.mockResolvedValue({
      items: [hit('$b'), hit('$c')],
      session: { batch: 2 },
      canPaginate: false,
    })

    await loadMore()

    expect(backPaginateRoomEventsSearchMock).toHaveBeenCalledWith({ batch: 1 })
    expect(retrievalStore.state.results.map((r) => r.eventId)).toEqual(['$a', '$b', '$c'])
    expect(retrievalStore.state.session).toEqual({ batch: 2 })
    expect(retrievalStore.state.canLoadMore).toBe(false)
    expect(retrievalStore.state.loadingMore).toBe(false)
  })

  it('loadMore is a no-op when there is no session or pagination is exhausted', async () => {
    await loadMore()
    expect(backPaginateRoomEventsSearchMock).not.toHaveBeenCalled()

    searchRoomEventsMock.mockResolvedValue({ items: [hit('$a')], session: { batch: 1 }, canPaginate: false })
    await search('hello')
    await loadMore()
    expect(backPaginateRoomEventsSearchMock).not.toHaveBeenCalled()
  })

  it('resetState clears results and search flags but keeps the provided query', () => {
    retrievalStore.setState((prev) => ({ ...prev, results: [hit('$a')], hasSearched: true, canLoadMore: true }))

    resetState('next')

    expect(retrievalStore.state.query).toBe('next')
    expect(retrievalStore.state.results).toEqual([])
    expect(retrievalStore.state.hasSearched).toBe(false)
    expect(retrievalStore.state.canLoadMore).toBe(false)
  })
})
