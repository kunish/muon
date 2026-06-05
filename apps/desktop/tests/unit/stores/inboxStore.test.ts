import { beforeEach, describe, expect, it } from 'vitest'
import { __resetUnifiedInboxForTests, useUnifiedInbox } from '@/features/chat/composables/useUnifiedInbox'
import {
  clearProcessed,
  clearSelection,
  hydrateProcessed,
  inboxStore,
  isProcessed,
  isSelected,
  markProcessed,
  markProcessedBatch,
  markSelectedProcessed,
  resetInboxStore,
  selectAll,
  setFilter,
  toggleSelection,
} from '@/features/chat/stores/inboxStore'

describe('inboxStore + useUnifiedInbox', () => {
  beforeEach(() => {
    localStorage.clear()
    resetInboxStore()
    __resetUnifiedInboxForTests()
  })

  it('aggregates unified inbox items', () => {
    const { allItems } = useUnifiedInbox()
    const types = new Set(allItems.value.map((item) => item.type))

    expect(types.has('mention')).toBe(true)
    expect(types.has('priority-unread')).toBe(true)
    expect(types.has('reply-needed')).toBe(true)
  })

  it('filters by type and supports all filter', () => {
    const { items } = useUnifiedInbox()

    setFilter('mention')
    expect(inboxStore.state.filter).toBe('mention')
    expect(items.value.length).toBeGreaterThan(0)
    expect(items.value.every((item) => item.type === 'mention')).toBe(true)

    setFilter('all')
    expect(inboxStore.state.filter).toBe('all')
    expect(items.value.length).toBeGreaterThan(0)
  })

  it('batch processes selected items', () => {
    const { items } = useUnifiedInbox()
    const targets = items.value.slice(0, 2).map((item) => item.id)

    selectAll(targets)
    markSelectedProcessed()

    expect(inboxStore.state.selectedItemIds.size).toBe(0)
    expect(targets.every((id) => isProcessed(id))).toBe(true)
  })

  it('restores processed state from localStorage', () => {
    markProcessed('mention:!group_project:localhost')

    // Simulate restart: reset store state but keep localStorage intact, then re-hydrate
    resetInboxStore()
    hydrateProcessed()

    expect(isProcessed('mention:!group_project:localhost')).toBe(true)
  })

  it('toggleSelection adds and removes ids', () => {
    toggleSelection('item-1')
    expect(isSelected('item-1')).toBe(true)

    toggleSelection('item-1')
    expect(isSelected('item-1')).toBe(false)
  })

  it('clearSelection empties the selection set', () => {
    selectAll(['a', 'b', 'c'])
    expect(inboxStore.state.selectedItemIds.size).toBe(3)

    clearSelection()
    expect(inboxStore.state.selectedItemIds.size).toBe(0)
  })

  it('markProcessedBatch marks multiple ids at once and persists', () => {
    markProcessedBatch(['x', 'y', 'z'])
    expect(isProcessed('x')).toBe(true)
    expect(isProcessed('y')).toBe(true)
    expect(isProcessed('z')).toBe(true)

    // Verify persistence: reset + re-hydrate
    resetInboxStore()
    hydrateProcessed()
    expect(isProcessed('x')).toBe(true)
    expect(isProcessed('z')).toBe(true)
  })

  it('clearProcessed empties processedItemIds and persists empty state', () => {
    markProcessed('some-id')
    expect(isProcessed('some-id')).toBe(true)

    clearProcessed()
    expect(inboxStore.state.processedItemIds.size).toBe(0)
    expect(isProcessed('some-id')).toBe(false)

    // Verify persistence: reset + re-hydrate should yield empty
    resetInboxStore()
    hydrateProcessed()
    expect(isProcessed('some-id')).toBe(false)
  })

  it('markSelectedProcessed is a no-op when selection is empty', () => {
    markProcessed('pre-existing')
    clearSelection()

    markSelectedProcessed()

    // processedItemIds unchanged beyond pre-existing
    expect(isProcessed('pre-existing')).toBe(true)
    expect(inboxStore.state.selectedItemIds.size).toBe(0)
  })

  it('hydrate-once guard: second hydrateProcessed call is a no-op', () => {
    markProcessed('first-item')
    // State is already hydrated (hydrateProcessed called at module load)
    // Call again — should not overwrite in-memory state
    hydrateProcessed()
    expect(isProcessed('first-item')).toBe(true)
  })
})
