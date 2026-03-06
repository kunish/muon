import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'
import { createMixedMembershipRooms, createSearchPageOne, createSearchPageTwo } from '../../mocks/matrix-search'

const mockBackPaginateRoomEventsSearch = vi.fn()

describe('matrix retrieval service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getRooms).mockReturnValue(createMixedMembershipRooms() as any)
    vi.mocked(mockClient.searchRoomEvents).mockResolvedValue(createSearchPageOne() as any)
    mockBackPaginateRoomEventsSearch.mockReset()
    ;(mockClient as any).backPaginateRoomEventsSearch = mockBackPaginateRoomEventsSearch
  })

  it('cross-room search passes term to sdk request', async () => {
    const { searchRoomEvents } = await import('@/matrix/retrieval')

    await searchRoomEvents('release')

    expect(mockClient.searchRoomEvents).toHaveBeenCalledTimes(1)
    expect(mockClient.searchRoomEvents).toHaveBeenCalledWith(
      expect.objectContaining({ term: 'release' }),
    )
  })

  it('joined-room scope only includes joined rooms in filter.rooms', async () => {
    const { searchRoomEvents } = await import('@/matrix/retrieval')

    await searchRoomEvents('release')

    const [request] = vi.mocked(mockClient.searchRoomEvents).mock.calls[0]
    expect(request.filter.rooms).toEqual(['!joined-alpha:localhost', '!joined-beta:localhost'])
    expect(request.filter.rooms).not.toContain('!left-gamma:localhost')
    expect(request.filter.rooms).not.toContain('!invite-delta:localhost')
  })

  it('pagination appends non-duplicate results and advances next batch token', async () => {
    const secondPage = createSearchPageTwo()

    mockBackPaginateRoomEventsSearch.mockImplementation(async (searchResults: any) => {
      searchResults.results = [...searchResults.results, ...secondPage.results]
      searchResults.next_batch = null
      return true
    })

    const { backPaginateRoomEventsSearch, searchRoomEvents } = await import('@/matrix/retrieval')
    const firstPage = await searchRoomEvents('release')

    expect(firstPage.session).toBeTruthy()

    const paged = await backPaginateRoomEventsSearch(firstPage.session!)
    const eventIds = paged.items.map(item => item.eventId)

    expect(mockBackPaginateRoomEventsSearch).toHaveBeenCalledTimes(1)
    expect(eventIds).toEqual(['$evt-1', '$evt-2', '$evt-3'])
    expect(paged.canPaginate).toBe(false)
    expect(paged.nextBatch).toBeNull()
  })

  it('returns empty result for blank keyword without sdk request', async () => {
    const { searchRoomEvents } = await import('@/matrix/retrieval')
    const page = await searchRoomEvents('   ')

    expect(page.items).toEqual([])
    expect(page.session).toBeNull()
    expect(page.canPaginate).toBe(false)
    expect(mockClient.searchRoomEvents).not.toHaveBeenCalled()
  })
})
