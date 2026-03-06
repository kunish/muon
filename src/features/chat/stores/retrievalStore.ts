import type { RetrievalItem } from '@matrix/index'
import { backPaginateRoomEventsSearch, searchRoomEvents } from '@matrix/index'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useRetrievalStore = defineStore('retrieval', () => {
  const query = ref('')
  const results = ref<RetrievalItem[]>([])
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasSearched = ref(false)
  const error = ref<string | null>(null)
  const canLoadMore = ref(false)
  const session = ref<any>(null)

  function resetState(nextQuery = '') {
    query.value = nextQuery
    results.value = []
    error.value = null
    hasSearched.value = false
    canLoadMore.value = false
    session.value = null
  }

  async function search(nextQuery: string) {
    const normalized = nextQuery.trim()
    query.value = nextQuery

    if (!normalized) {
      resetState(nextQuery)
      return
    }

    loading.value = true
    hasSearched.value = true
    error.value = null
    canLoadMore.value = false
    session.value = null
    results.value = []

    try {
      const page = await searchRoomEvents(normalized)
      results.value = page.items
      session.value = page.session
      canLoadMore.value = page.canPaginate
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
      results.value = []
      canLoadMore.value = false
      session.value = null
    }
    finally {
      loading.value = false
    }
  }

  async function loadMore() {
    if (!session.value || !canLoadMore.value || loading.value || loadingMore.value)
      return

    loadingMore.value = true
    error.value = null

    try {
      const page = await backPaginateRoomEventsSearch(session.value as any)
      results.value = page.items
      session.value = page.session
      canLoadMore.value = page.canPaginate
    }
    catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      error.value = message
    }
    finally {
      loadingMore.value = false
    }
  }

  return {
    query,
    results,
    loading,
    loadingMore,
    hasSearched,
    error,
    canLoadMore,
    search,
    loadMore,
    resetState,
  }
})
