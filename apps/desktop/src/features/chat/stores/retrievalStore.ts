import type { RetrievalItem, RetrievalSession } from '@matrix/index'
import type { DesktopEffect } from '@/shared/lib/effect'
import { backPaginateRoomEventsSearch, searchRoomEvents } from '@matrix/index'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'

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

export const useRetrievalStore = defineStore('retrieval', () => {
  const query = ref('')
  const results = shallowRef<RetrievalItem[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasSearched = ref(false)
  const error = ref<string | null>(null)
  const canLoadMore = ref(false)
  const session = shallowRef<RetrievalSession | null>(null)

  function resetState(nextQuery = '') {
    query.value = nextQuery
    results.value = []
    error.value = null
    hasSearched.value = false
    canLoadMore.value = false
    session.value = null
  }

  function searchEffect(nextQuery: string): DesktopEffect<void> {
    return Effect.gen(function* () {
      const normalized = nextQuery.trim()
      yield* fromSync(() => {
        query.value = nextQuery
      })

      if (!normalized) {
        yield* fromSync(() => resetState(nextQuery))
        return
      }

      yield* fromSync(() => {
        loading.value = true
        hasSearched.value = true
        error.value = null
        canLoadMore.value = false
        session.value = null
        results.value = []
      })

      yield* fromPromise(() => searchRoomEvents(normalized)).pipe(
        Effect.flatMap((page) =>
          fromSync(() => {
            results.value = [...page.items]
            session.value = page.session
            canLoadMore.value = page.canPaginate
          }),
        ),
        Effect.catchAll((err) =>
          fromSync(() => {
            const message = err instanceof Error ? err.message : String(err)
            error.value = message
            results.value = []
            canLoadMore.value = false
            session.value = null
          }),
        ),
      )
    }).pipe(Effect.ensuring(Effect.sync(() => void (loading.value = false))))
  }

  function search(nextQuery: string) {
    return runDesktopEffect(searchEffect(nextQuery))
  }

  function loadMoreEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      const currentSession = session.value
      if (!currentSession || !canLoadMore.value || loading.value || loadingMore.value) return

      yield* fromSync(() => {
        loadingMore.value = true
        error.value = null
      })

      yield* fromPromise(() => backPaginateRoomEventsSearch(currentSession)).pipe(
        Effect.flatMap((page) =>
          fromSync(() => {
            results.value = mergeResults(results.value, page.items)
            session.value = page.session
            canLoadMore.value = page.canPaginate
          }),
        ),
        Effect.catchAll((err) =>
          fromSync(() => {
            const message = err instanceof Error ? err.message : String(err)
            error.value = message
          }),
        ),
      )
    }).pipe(Effect.ensuring(Effect.sync(() => void (loadingMore.value = false))))
  }

  function loadMore() {
    return runDesktopEffect(loadMoreEffect())
  }

  return {
    query,
    results,
    loading,
    loadingMore,
    hasSearched,
    error,
    canLoadMore,
    searchEffect,
    loadMoreEffect,
    search,
    loadMore,
    resetState,
  }
})
