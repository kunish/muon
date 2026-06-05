import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDeferredItem,
  deferStore,
  markArchived,
  markCompleted,
  resetDeferStore,
  resolveReminderDueAt,
  selectActiveDeferItems,
  selectHistoryDeferItems,
} from '@/features/chat/stores/deferStore'
import { DEFER_STORAGE_KEY } from '@/features/chat/types/defer'

describe('deferStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetDeferStore()
  })

  it('createDeferredItem 接收 preset/custom 时间并写入 dueAt', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    const presetItem = createDeferredItem({
      id: 'defer-preset',
      roomId: '!room:example.org',
      eventId: '$event:preset',
      reminder: { preset: 'tomorrow' },
      now,
    })

    const customItem = createDeferredItem({
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
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    createDeferredItem({
      id: 'late',
      roomId: '!room:example.org',
      eventId: '$late',
      reminder: { preset: 'custom', dueAt: now + 9_000 },
      now,
    })
    createDeferredItem({
      id: 'early',
      roomId: '!room:example.org',
      eventId: '$early',
      reminder: { preset: 'custom', dueAt: now + 3_000 },
      now,
    })

    markCompleted('late')

    expect(selectActiveDeferItems(deferStore.state).map((item) => item.id)).toEqual(['early'])
  })

  it('markCompleted/markArchived 后进入 historyItems 并移出 activeItems', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    createDeferredItem({
      id: 'defer-1',
      roomId: '!room:example.org',
      eventId: '$event-1',
      reminder: { preset: 'custom', dueAt: now + 1_000 },
      now,
    })
    createDeferredItem({
      id: 'defer-2',
      roomId: '!room:example.org',
      eventId: '$event-2',
      reminder: { preset: 'custom', dueAt: now + 2_000 },
      now,
    })

    markCompleted('defer-1')
    markArchived('defer-2')

    expect(selectActiveDeferItems(deferStore.state)).toHaveLength(0)
    expect(
      selectHistoryDeferItems(deferStore.state)
        .map((item) => item.status)
        .sort(),
    ).toEqual(['archived', 'completed'])
  })

  it('hydrate 可恢复 localStorage，schema 无效时降级为空', () => {
    localStorage.setItem(
      DEFER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        items: [
          {
            id: 'persisted',
            roomId: '!room:example.org',
            eventId: '$event:persisted',
            dueAt: 123,
            status: 'deferred',
            createdAt: 100,
            updatedAt: 100,
          },
        ],
      }),
    )

    resetDeferStore()
    expect(selectActiveDeferItems(deferStore.state).map((item) => item.id)).toEqual(['persisted'])

    localStorage.setItem(DEFER_STORAGE_KEY, JSON.stringify({ version: 1, items: [{ bad: true }] }))
    resetDeferStore()
    expect(selectActiveDeferItems(deferStore.state)).toHaveLength(0)
    expect(selectHistoryDeferItems(deferStore.state)).toHaveLength(0)
  })

  it('resolveReminderDueAt preset cases', () => {
    const now = Date.UTC(2026, 0, 1, 10, 0, 0)

    expect(resolveReminderDueAt({ preset: 'in-1-hour' }, now)).toBe(now + 60 * 60 * 1000)
    expect(resolveReminderDueAt({ preset: 'later-today' }, now)).toBe(now + 2 * 60 * 60 * 1000)
    expect(resolveReminderDueAt({ preset: 'tomorrow' }, now)).toBe(now + 24 * 60 * 60 * 1000)
    expect(resolveReminderDueAt({ preset: 'next-week' }, now)).toBe(now + 7 * 24 * 60 * 60 * 1000)
    expect(resolveReminderDueAt({ preset: 'custom', dueAt: now + 5_000 }, now)).toBe(now + 5_000)
    expect(resolveReminderDueAt({ preset: 'custom' }, now)).toBe(now)
  })
})
