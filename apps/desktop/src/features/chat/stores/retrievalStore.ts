import type { RetrievalItem, RetrievalSession } from '@matrix/index'
import { backPaginateRoomEventsSearch, searchRoomEvents } from '@matrix/index'
import { Store } from '@tanstack/vue-store'

function mergeResults(current: RetrievalItem[], next: RetrievalItem[]) {
  const merged = [...current]
  const seenEventIds = new Set(current.map((item) => item.eventId))

  for (const item of next) {
    if (seenEventIds.has(item.eventId)) continue
    seenEventIds.add(item.eventId)
    merged.push(item)
  }

  return merged
}

export interface RetrievalState {
  query: string
  results: RetrievalItem[]
  loading: boolean
  loadingMore: boolean
  hasSearched: boolean
  error: string | null
  canLoadMore: boolean
  session: RetrievalSession | null
}

function createInitialState(): RetrievalState {
  return {
    query: '',
    results: [],
    loading: false,
    loadingMore: false,
    hasSearched: false,
    error: null,
    canLoadMore: false,
    session: null,
  }
}

export const retrievalStore = new Store<RetrievalState>(createInitialState())

/** Clear the result set and search flags, keeping (and recording) the provided query. */
export function resetState(nextQuery = '') {
  retrievalStore.setState((prev) => ({
    ...prev,
    query: nextQuery,
    results: [],
    error: null,
    hasSearched: false,
    canLoadMore: false,
    session: null,
  }))
}

export async function search(nextQuery: string) {
  const normalized = nextQuery.trim()
  retrievalStore.setState((prev) => ({ ...prev, query: nextQuery }))

  if (!normalized) {
    resetState(nextQuery)
    return
  }

  retrievalStore.setState((prev) => ({
    ...prev,
    loading: true,
    hasSearched: true,
    error: null,
    canLoadMore: false,
    session: null,
    results: [],
  }))

  try {
    const page = await searchRoomEvents(normalized)
    retrievalStore.setState((prev) => ({
      ...prev,
      results: [...page.items],
      session: page.session,
      canLoadMore: page.canPaginate,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    retrievalStore.setState((prev) => ({ ...prev, error: message, results: [], canLoadMore: false, session: null }))
  } finally {
    retrievalStore.setState((prev) => ({ ...prev, loading: false }))
  }
}

export async function loadMore() {
  const { session, canLoadMore, loading, loadingMore } = retrievalStore.state
  if (!session || !canLoadMore || loading || loadingMore) return

  retrievalStore.setState((prev) => ({ ...prev, loadingMore: true, error: null }))

  try {
    const page = await backPaginateRoomEventsSearch(session)
    retrievalStore.setState((prev) => ({
      ...prev,
      results: mergeResults(prev.results, page.items),
      session: page.session,
      canLoadMore: page.canPaginate,
    }))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    retrievalStore.setState((prev) => ({ ...prev, error: message }))
  } finally {
    retrievalStore.setState((prev) => ({ ...prev, loadingMore: false }))
  }
}

export function resetRetrievalStore() {
  retrievalStore.setState(() => createInitialState())
}
