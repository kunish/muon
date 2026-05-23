import type { InboxFilterType } from '../types/unifiedInbox'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { INBOX_PROCESSED_STORAGE_KEY } from '../types/unifiedInbox'

function loadProcessedIds(): Set<string> {
  return runDesktopSync(loadProcessedIdsEffect())
}

function loadProcessedIdsEffect(): DesktopEffect<Set<string>> {
  return fromSync(() => {
    const raw = localStorage.getItem(INBOX_PROCESSED_STORAGE_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw) as { processedIds?: unknown }
    return new Set(
      Array.isArray(parsed.processedIds)
        ? parsed.processedIds.filter((id): id is string => typeof id === 'string')
        : [],
    )
  }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())))
}

function persistProcessedIds(ids: Set<string>) {
  runDesktopSync(persistProcessedIdsEffect(ids))
}

function persistProcessedIdsEffect(ids: Set<string>): DesktopEffect<void> {
  return fromSync(() =>
    localStorage.setItem(INBOX_PROCESSED_STORAGE_KEY, JSON.stringify({ processedIds: [...ids] })),
  ).pipe(Effect.catchAll(() => Effect.void))
}

export const useInboxStore = defineStore('inbox', () => {
  const filter = ref<InboxFilterType>('all')
  const selectedItemIds = reactive(new Set<string>())
  const processedItemIds = reactive(new Set<string>())
  const hydrated = ref(false)

  function hydrateProcessedEffect(): DesktopEffect<void> {
    return fromSync(() => {
      if (hydrated.value) return
      hydrated.value = true
      processedItemIds.clear()
      for (const id of loadProcessedIds()) {
        processedItemIds.add(id)
      }
    })
  }

  function hydrateProcessed() {
    return runDesktopSync(hydrateProcessedEffect())
  }

  function setFilter(next: InboxFilterType) {
    filter.value = next
  }

  function toggleSelection(itemId: string) {
    if (selectedItemIds.has(itemId)) selectedItemIds.delete(itemId)
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

  function markProcessedEffect(itemId: string): DesktopEffect<void> {
    return fromSync(() => {
      processedItemIds.add(itemId)
      persistProcessedIds(processedItemIds)
    })
  }

  function markProcessed(itemId: string) {
    return runDesktopSync(markProcessedEffect(itemId))
  }

  function markProcessedBatchEffect(itemIds: string[]): DesktopEffect<void> {
    return fromSync(() => {
      for (const id of itemIds) {
        processedItemIds.add(id)
      }
      persistProcessedIds(processedItemIds)
    })
  }

  function markProcessedBatch(itemIds: string[]) {
    return runDesktopSync(markProcessedBatchEffect(itemIds))
  }

  function markSelectedProcessedEffect(): DesktopEffect<void> {
    return fromSync(() => {
      if (selectedItemIds.size === 0) return
      for (const id of selectedItemIds) {
        processedItemIds.add(id)
      }
      persistProcessedIds(processedItemIds)
      selectedItemIds.clear()
    })
  }

  function markSelectedProcessed() {
    return runDesktopSync(markSelectedProcessedEffect())
  }

  function isProcessed(itemId: string) {
    return processedItemIds.has(itemId)
  }

  function clearProcessedEffect(): DesktopEffect<void> {
    return fromSync(() => {
      processedItemIds.clear()
      persistProcessedIds(processedItemIds)
    })
  }

  function clearProcessed() {
    return runDesktopSync(clearProcessedEffect())
  }

  hydrateProcessed()

  return {
    filter,
    selectedItemIds,
    processedItemIds,
    hydrated,
    hydrateProcessedEffect,
    markProcessedEffect,
    markProcessedBatchEffect,
    markSelectedProcessedEffect,
    clearProcessedEffect,
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
