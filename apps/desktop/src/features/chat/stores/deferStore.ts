import type { DeferItem, DeferStatus, ReminderPreset } from '../types/defer'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { createDeferItem, DEFER_STORAGE_KEY, isDeferActive, transitionDeferStatus } from '../types/defer'

interface PersistedDeferState {
  version: 1
  items: DeferItem[]
}

interface ReminderInput {
  preset: ReminderPreset
  dueAt?: number
}

interface CreateDeferredItemInput {
  id: string
  roomId: string
  eventId: string
  reminder: ReminderInput
  now?: number
}

function isValidDeferStatus(status: unknown): status is DeferStatus {
  return status === 'deferred' || status === 'completed' || status === 'archived'
}

function isValidDeferItem(value: unknown): value is DeferItem {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<DeferItem>
  return (
    !!candidate.id &&
    !!candidate.roomId &&
    !!candidate.eventId &&
    typeof candidate.dueAt === 'number' &&
    isValidDeferStatus(candidate.status) &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number'
  )
}

export function resolveReminderDueAt(reminder: ReminderInput, now: number): number {
  const base = new Date(now)

  switch (reminder.preset) {
    case 'in-1-hour':
      return now + 60 * 60 * 1000
    case 'tonight': {
      const due = new Date(base)
      due.setHours(21, 0, 0, 0)
      if (due.getTime() <= now) due.setDate(due.getDate() + 1)
      return due.getTime()
    }
    case 'tomorrow-morning': {
      const due = new Date(base)
      due.setDate(due.getDate() + 1)
      due.setHours(9, 0, 0, 0)
      return due.getTime()
    }
    case 'later-today':
      return now + 2 * 60 * 60 * 1000
    case 'tomorrow':
      return now + 24 * 60 * 60 * 1000
    case 'next-week':
      return now + 7 * 24 * 60 * 60 * 1000
    case 'custom':
      if (typeof reminder.dueAt === 'number') return reminder.dueAt
      return now
    default:
      return now
  }
}

function loadState(): DeferItem[] {
  return runDesktopSync(loadStateEffect())
}

function loadStateEffect(): DesktopEffect<DeferItem[]> {
  return fromSync(() => {
    const raw = localStorage.getItem(DEFER_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as Partial<PersistedDeferState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return []

    return parsed.items.filter(isValidDeferItem)
  }).pipe(Effect.catchAll(() => Effect.succeed([])))
}

function persistState(items: DeferItem[]) {
  const payload: PersistedDeferState = {
    version: 1,
    items,
  }

  runDesktopSync(persistStateEffect(payload))
}

function persistStateEffect(payload: PersistedDeferState): DesktopEffect<void> {
  return fromSync(() => localStorage.setItem(DEFER_STORAGE_KEY, JSON.stringify(payload))).pipe(
    Effect.catchAll(() => Effect.void),
  )
}

export const useDeferStore = defineStore('defer', () => {
  const items = ref<DeferItem[]>([])
  const hydrated = ref(false)

  const activeItems = computed(() => {
    return items.value
      .filter(isDeferActive)
      .slice()
      .sort((a, b) => a.dueAt - b.dueAt)
  })

  const historyItems = computed(() => {
    return items.value
      .filter((item) => item.status !== 'deferred')
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  function hydrateEffect(): DesktopEffect<void> {
    return fromSync(() => {
      if (hydrated.value) return
      hydrated.value = true
      items.value = loadState()
    })
  }

  function hydrate() {
    return runDesktopSync(hydrateEffect())
  }

  function createDeferredItemEffect(input: CreateDeferredItemInput): DesktopEffect<DeferItem> {
    return fromSync(() => {
      const now = input.now ?? Date.now()
      const dueAt = resolveReminderDueAt(input.reminder, now)
      const item = createDeferItem({
        id: input.id,
        roomId: input.roomId,
        eventId: input.eventId,
        dueAt,
        now,
      })

      items.value.push(item)
      persistState(items.value)
      return item
    })
  }

  function createDeferredItem(input: CreateDeferredItemInput) {
    return runDesktopSync(createDeferredItemEffect(input))
  }

  function updateStatusEffect(id: string, nextStatus: Exclude<DeferStatus, 'deferred'>): DesktopEffect<void> {
    return fromSync(() => {
      const index = items.value.findIndex((item) => item.id === id)
      if (index < 0) return
      items.value[index] = transitionDeferStatus(items.value[index], nextStatus)
      persistState(items.value)
    })
  }

  function markCompletedEffect(id: string): DesktopEffect<void> {
    return updateStatusEffect(id, 'completed')
  }

  function markCompleted(id: string) {
    return runDesktopSync(markCompletedEffect(id))
  }

  function markArchivedEffect(id: string): DesktopEffect<void> {
    return updateStatusEffect(id, 'archived')
  }

  function markArchived(id: string) {
    return runDesktopSync(markArchivedEffect(id))
  }

  hydrate()

  return {
    items,
    hydrated,
    activeItems,
    historyItems,
    hydrateEffect,
    createDeferredItemEffect,
    updateStatusEffect,
    markCompletedEffect,
    markArchivedEffect,
    hydrate,
    createDeferredItem,
    markCompleted,
    markArchived,
  }
})
