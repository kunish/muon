import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { __resetUnifiedInboxForTests, useUnifiedInbox } from '@/features/chat/composables/useUnifiedInbox'
import { useInboxStore } from '@/features/chat/stores/inboxStore'

describe('inboxStore + useUnifiedInbox', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetUnifiedInboxForTests()
  })

  it('aggregates unified inbox items', () => {
    const { allItems } = useUnifiedInbox()
    const types = new Set(allItems.value.map(item => item.type))

    expect(types.has('mention')).toBe(true)
    expect(types.has('priority-unread')).toBe(true)
    expect(types.has('reply-needed')).toBe(true)
  })

  it('filters by type and supports all filter', () => {
    const store = useInboxStore()
    const { items } = useUnifiedInbox()

    store.setFilter('mention')
    expect(items.value.length).toBeGreaterThan(0)
    expect(items.value.every(item => item.type === 'mention')).toBe(true)

    store.setFilter('all')
    expect(items.value.length).toBeGreaterThan(0)
  })

  it('batch processes selected items', () => {
    const store = useInboxStore()
    const { items } = useUnifiedInbox()
    const targets = items.value.slice(0, 2).map(item => item.id)

    store.selectAll(targets)
    store.markSelectedProcessed()

    expect(store.selectedItemIds.size).toBe(0)
    expect(targets.every(id => store.isProcessed(id))).toBe(true)
  })

  it('restores processed state from localStorage', () => {
    const first = useInboxStore()
    first.markProcessed('mention:!group_project:localhost')

    setActivePinia(createPinia())
    const second = useInboxStore()
    expect(second.isProcessed('mention:!group_project:localhost')).toBe(true)
  })
})
