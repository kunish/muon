import type { InboxFilterType } from '../types/unifiedInbox'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { INBOX_PROCESSED_STORAGE_KEY } from '../types/unifiedInbox'

function loadProcessedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(INBOX_PROCESSED_STORAGE_KEY)
    if (!raw)
      return new Set()
    const parsed = JSON.parse(raw) as { processedIds?: string[] }
    return new Set(parsed.processedIds ?? [])
  }
  catch {
    return new Set()
  }
}

function persistProcessedIds(ids: Set<string>) {
  try {
    localStorage.setItem(
      INBOX_PROCESSED_STORAGE_KEY,
      JSON.stringify({ processedIds: [...ids] }),
    )
  }
  catch {
    // 忽略持久化异常（如隐私模式）
  }
}

export const useInboxStore = defineStore('inbox', () => {
  const filter = ref<InboxFilterType>('all')
  const selectedItemIds = reactive(new Set<string>())
  const processedItemIds = reactive(new Set<string>())
  const hydrated = ref(false)

  function hydrateProcessed() {
    if (hydrated.value)
      return
    hydrated.value = true
    processedItemIds.clear()
    for (const id of loadProcessedIds()) {
      processedItemIds.add(id)
    }
  }

  function setFilter(next: InboxFilterType) {
    filter.value = next
  }

  function toggleSelection(itemId: string) {
    if (selectedItemIds.has(itemId))
      selectedItemIds.delete(itemId)
    else selectedItemIds.add(itemId)
  }

  function selectAll(itemIds: string[]) {
    selectedItemIds.clear()
    for (const id of itemIds) {
      selectedItemIds.add(id)
    }
  }

  function clearSelection() {
    selectedItemIds.clear()
  }

  function isSelected(itemId: string) {
    return selectedItemIds.has(itemId)
  }

  function markProcessed(itemId: string) {
    processedItemIds.add(itemId)
    persistProcessedIds(processedItemIds)
  }

  function markProcessedBatch(itemIds: string[]) {
    for (const id of itemIds) {
      processedItemIds.add(id)
    }
    persistProcessedIds(processedItemIds)
  }

  function markSelectedProcessed() {
    if (selectedItemIds.size === 0)
      return
    markProcessedBatch([...selectedItemIds])
    clearSelection()
  }

  function isProcessed(itemId: string) {
    return processedItemIds.has(itemId)
  }

  function clearProcessed() {
    processedItemIds.clear()
    persistProcessedIds(processedItemIds)
  }

  hydrateProcessed()

  return {
    filter,
    selectedItemIds,
    processedItemIds,
    hydrated,
    hydrateProcessed,
    setFilter,
    toggleSelection,
    selectAll,
    clearSelection,
    isSelected,
    markProcessed,
    markProcessedBatch,
    markSelectedProcessed,
    isProcessed,
    clearProcessed,
  }
})
