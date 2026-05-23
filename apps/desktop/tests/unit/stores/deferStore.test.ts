import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useDeferStore } from '@/features/chat/stores/deferStore'
import { DEFER_STORAGE_KEY } from '@/features/chat/types/defer'

describe('deferStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('createDeferredItem 接收 preset/custom 时间并写入 dueAt', () => {
    const store = useDeferStore()
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    const presetItem = store.createDeferredItem({
      id: 'defer-preset',
      roomId: '!room:example.org',
      eventId: '$event:preset',
      reminder: { preset: 'tomorrow' },
      now,
    })

    const customItem = store.createDeferredItem({
      id: 'defer-custom',
      roomId: '!room:example.org',
      eventId: '$event:custom',
      reminder: { preset: 'custom', dueAt: now + 2_700_000 },
      now,
    })

    expect(presetItem.dueAt).toBe(now + 24 * 60 * 60 * 1000)
    expect(customItem.dueAt).toBe(now + 2_700_000)
  })

  it('activeItems 仅包含 deferred，且按 dueAt 升序', () => {
    const store = useDeferStore()
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    store.createDeferredItem({
      id: 'late',
      roomId: '!room:example.org',
      eventId: '$late',
      reminder: { preset: 'custom', dueAt: now + 9_000 },
      now,
    })
    store.createDeferredItem({
      id: 'early',
      roomId: '!room:example.org',
      eventId: '$early',
      reminder: { preset: 'custom', dueAt: now + 3_000 },
      now,
    })

    store.markCompleted('late')

    expect(store.activeItems.map(item => item.id)).toEqual(['early'])
  })

  it('markCompleted/markArchived 后进入 historyItems 并移出 activeItems', () => {
    const store = useDeferStore()
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    store.createDeferredItem({
      id: 'defer-1',
      roomId: '!room:example.org',
      eventId: '$event-1',
      reminder: { preset: 'custom', dueAt: now + 1_000 },
      now,
    })
    store.createDeferredItem({
      id: 'defer-2',
      roomId: '!room:example.org',
      eventId: '$event-2',
      reminder: { preset: 'custom', dueAt: now + 2_000 },
      now,
    })

    store.markCompleted('defer-1')
    store.markArchived('defer-2')

    expect(store.activeItems).toHaveLength(0)
    expect(store.historyItems.map(item => item.status).sort()).toEqual(['archived', 'completed'])
  })

  it('hydrate 可恢复 localStorage，schema 无效时降级为空', () => {
    localStorage.setItem(
      DEFER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items: [{
          id: 'persisted',
          roomId: '!room:example.org',
          eventId: '$event:persisted',
          dueAt: 123,
          status: 'deferred',
          createdAt: 100,
          updatedAt: 100,
        }],
      }),
    )

    const store = useDeferStore()
    store.hydrate()
    expect(store.activeItems.map(item => item.id)).toEqual(['persisted'])

    localStorage.setItem(DEFER_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ bad: true }] }))
    setActivePinia(createPinia())
    const degraded = useDeferStore()
    degraded.hydrate()
    expect(degraded.activeItems).toHaveLength(0)
    expect(degraded.historyItems).toHaveLength(0)
  })
})
