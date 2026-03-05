import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  createDeferItem,
  DEFER_STORAGE_KEY,
  isDeferActive,
  transitionDeferStatus,
} from '../types/defer'
import type { DeferItem, DeferStatus, ReminderPreset } from '../types/defer'

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
  if (!value || typeof value !== 'object')
    return false

  const candidate = value as Partial<DeferItem>
  return !!candidate.id
    && !!candidate.roomId
    && !!candidate.eventId
    && typeof candidate.dueAt === 'number'
    && isValidDeferStatus(candidate.status)
    && typeof candidate.createdAt === 'number'
    && typeof candidate.updatedAt === 'number'
}

export function resolveReminderDueAt(reminder: ReminderInput, now: number): number {
  const base = new Date(now)

  switch (reminder.preset) {
    case 'in-1-hour':
      return now + 60 * 60 * 1000
    case 'tonight': {
      const due = new Date(base)
      due.setHours(21, 0, 0, 0)
      if (due.getTime() <= now)
        due.setDate(due.getDate() + 1)
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
      if (typeof reminder.dueAt === 'number')
        return reminder.dueAt
      return now
    default:
      return now
  }
}

function loadState(): DeferItem[] {
  try {
    const raw = localStorage.getItem(DEFER_STORAGE_KEY)
    if (!raw)
      return []

    const parsed = JSON.parse(raw) as Partial<PersistedDeferState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items))
      return []

    return parsed.items.filter(isValidDeferItem)
  }
  catch {
    return []
  }
}

function persistState(items: DeferItem[]) {
  const payload: PersistedDeferState = {
    version: 1,
    items,
  }

  try {
    localStorage.setItem(DEFER_STORAGE_KEY, JSON.stringify(payload))
  }
  catch {
    // 忽略持久化失败（例如隐私模式）
  }
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
      .filter(item => item.status !== 'deferred')
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
  })

  function hydrate() {
    if (hydrated.value)
      return
    hydrated.value = true
    items.value = loadState()
  }

  function createDeferredItem(input: CreateDeferredItemInput) {
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
  }

  function updateStatus(id: string, nextStatus: Exclude<DeferStatus, 'deferred'>) {
    const index = items.value.findIndex(item => item.id === id)
    if (index < 0)
      return
    items.value[index] = transitionDeferStatus(items.value[index], nextStatus)
    persistState(items.value)
  }

  function markCompleted(id: string) {
    updateStatus(id, 'completed')
  }

  function markArchived(id: string) {
    updateStatus(id, 'archived')
  }

  hydrate()

  return {
    items,
    hydrated,
    activeItems,
    historyItems,
    hydrate,
    createDeferredItem,
    markCompleted,
    markArchived,
  }
})
