import type { DeferItem, DeferStatus, ReminderPreset } from '../types/defer'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Store } from '@tanstack/vue-store'
import { Effect } from 'effect'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
import { createDeferItem, DEFER_STORAGE_KEY, isDeferActive, transitionDeferStatus } from '../types/defer'

// ---------------------------------------------------------------------------
// Persisted shape
// ---------------------------------------------------------------------------

interface PersistedDeferState {
  version: 1
  items: DeferItem[]
}

// ---------------------------------------------------------------------------
// Public input types
// ---------------------------------------------------------------------------

interface ReminderInput {
  preset: ReminderPreset
  dueAt?: number
}

export interface CreateDeferredItemInput {
  id: string
  roomId: string
  eventId: string
  reminder: ReminderInput
  now?: number
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Exported pure function — kept exported (may be used elsewhere)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function loadStateEffect(): DesktopEffect<DeferItem[]> {
  return fromSync(() => {
    const raw = localStorage.getItem(DEFER_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw) as Partial<PersistedDeferState>
    if (parsed.version !== 1 || !Array.isArray(parsed.items)) return []

    return parsed.items.filter(isValidDeferItem)
  }).pipe(Effect.catchAll(() => Effect.succeed([])))
}

function loadState(): DeferItem[] {
  return runDesktopSync(loadStateEffect())
}

function persistStateEffect(payload: PersistedDeferState): DesktopEffect<void> {
  return fromSync(() => localStorage.setItem(DEFER_STORAGE_KEY, JSON.stringify(payload))).pipe(
    Effect.catchAll(() => Effect.void),
  )
}

function persistState(items: DeferItem[]) {
  const payload: PersistedDeferState = {
    version: 1,
    items,
  }

  runDesktopSync(persistStateEffect(payload))
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface DeferState {
  items: DeferItem[]
  hydrated: boolean
}

function createInitialState(): DeferState {
  return { items: loadState(), hydrated: true }
}

export const deferStore = new Store<DeferState>(createInitialState())

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectActiveDeferItems(state: DeferState): DeferItem[] {
  return state.items
    .filter(isDeferActive)
    .slice()
    .sort((a, b) => a.dueAt - b.dueAt)
}

export function selectHistoryDeferItems(state: DeferState): DeferItem[] {
  return state.items
    .filter((item) => item.status !== 'deferred')
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export function createDeferredItem(input: CreateDeferredItemInput): DeferItem {
  const now = input.now ?? Date.now()
  const dueAt = resolveReminderDueAt(input.reminder, now)
  const item = createDeferItem({
    id: input.id,
    roomId: input.roomId,
    eventId: input.eventId,
    dueAt,
    now,
  })

  deferStore.setState((s) => ({ ...s, items: [...s.items, item] }))
  persistState(deferStore.state.items)
  return item
}

function updateStatus(id: string, nextStatus: Exclude<DeferStatus, 'deferred'>): void {
  const index = deferStore.state.items.findIndex((item) => item.id === id)
  if (index < 0) return

  const updated = transitionDeferStatus(deferStore.state.items[index], nextStatus)

  deferStore.setState((s) => {
    const next = [...s.items]
    next[index] = updated
    return { ...s, items: next }
  })
  persistState(deferStore.state.items)
}

export function markCompleted(id: string): void {
  updateStatus(id, 'completed')
}

export function markArchived(id: string): void {
  updateStatus(id, 'archived')
}

export function hydrate(): void {
  if (deferStore.state.hydrated) return
  deferStore.setState(() => ({ items: loadState(), hydrated: true }))
}

export function resetDeferStore(): void {
  deferStore.setState(() => createInitialState())
}
