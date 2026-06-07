import type { ActionItem, Minute } from '../types/minute'
import { Store } from '@tanstack/vue-store'
import {
  generateActionItemId,
  generateMinuteId,
  isValidMinute,
  isValidMinuteDate,
  MINUTES_STORAGE_KEY,
} from '../types/minute'

interface PersistedMinutesState {
  version: 1
  minutes: Minute[]
}

interface LoadedMinutesState {
  minutes: Minute[]
  normalized: boolean
}

interface AddMinuteInput {
  id?: string
  title: string
  date: string
  attendees?: string
  agenda?: string
  decisions?: string
  notes?: string
  now?: number
}

function normalizePersistedMinutes(minutes: unknown[]): LoadedMinutesState {
  const deduped = new Map<string, Minute>()
  let normalized = false

  for (const minute of minutes) {
    if (!isValidMinute(minute)) {
      normalized = true
      continue
    }
    if (deduped.has(minute.id)) normalized = true
    deduped.set(minute.id, minute)
  }

  return { minutes: [...deduped.values()], normalized }
}

function loadState(): LoadedMinutesState {
  try {
    const raw = localStorage.getItem(MINUTES_STORAGE_KEY)
    if (!raw) return { minutes: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedMinutesState>
    if (parsed.version !== 1 || !Array.isArray(parsed.minutes)) return { minutes: [], normalized: false }

    return normalizePersistedMinutes(parsed.minutes)
  } catch {
    return { minutes: [], normalized: false }
  }
}

function persistMinutes(minutes: Minute[]): void {
  const payload: PersistedMinutesState = { version: 1, minutes }
  try {
    localStorage.setItem(MINUTES_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[minuteStore] Failed to persist minutes:', err)
  }
}

export interface MinutesState {
  /** 用户创建的会议纪要，持久化到 localStorage（version-1 信封）。 */
  minutes: Minute[]
  hydrated: boolean
}

function createInitialState(): MinutesState {
  const { minutes, normalized } = loadState()
  if (normalized) persistMinutes(minutes)
  return { minutes, hydrated: true }
}

export const minuteStore = new Store<MinutesState>(createInitialState())

/** 响应式读取纪要列表 —— 消费方通过 `useSelector` 选用。 */
export function selectMinutes(state: MinutesState): Minute[] {
  return state.minutes
}

/** 从 localStorage 重新读取纪要到 store。 */
export function hydrate(): void {
  const { minutes, normalized } = loadState()
  minuteStore.setState((s) => ({ ...s, minutes, hydrated: true }))
  if (normalized) persistMinutes(minutes)
}

function commit(minutes: Minute[]): void {
  minuteStore.setState((s) => ({ ...s, minutes }))
  persistMinutes(minuteStore.state.minutes)
}

function mapMinute(id: string, fn: (minute: Minute) => Minute): void {
  commit(minuteStore.state.minutes.map((minute) => (minute.id === id ? fn(minute) : minute)))
}

export function addMinute(input: AddMinuteInput): Minute {
  const title = input.title.trim()
  if (!title) throw new Error('Minute title is required')
  if (!isValidMinuteDate(input.date)) throw new Error('Invalid minute date')

  const now = input.now ?? Date.now()
  const minute: Minute = {
    id: input.id ?? generateMinuteId(now),
    title,
    date: input.date,
    attendees: input.attendees?.trim() || '我',
    agenda: input.agenda?.trim() || undefined,
    decisions: input.decisions?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    actionItems: [],
    createdAt: now,
  }

  if (!isValidMinute(minute)) throw new Error('Invalid minute')

  commit([minute, ...minuteStore.state.minutes])
  return minute
}

export function updateMinute(
  id: string,
  patch: Partial<Pick<Minute, 'title' | 'date' | 'attendees' | 'agenda' | 'decisions' | 'notes'>>,
): void {
  mapMinute(id, (minute) => ({
    ...minute,
    ...(patch.title !== undefined ? { title: patch.title.trim() || minute.title } : {}),
    ...(patch.date !== undefined && isValidMinuteDate(patch.date) ? { date: patch.date } : {}),
    ...(patch.attendees !== undefined ? { attendees: patch.attendees.trim() || minute.attendees } : {}),
    ...(patch.agenda !== undefined ? { agenda: patch.agenda.trim() || undefined } : {}),
    ...(patch.decisions !== undefined ? { decisions: patch.decisions.trim() || undefined } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes.trim() || undefined } : {}),
  }))
}

export function removeMinute(id: string): void {
  const next = minuteStore.state.minutes.filter((minute) => minute.id !== id)
  if (next.length === minuteStore.state.minutes.length) return
  commit(next)
}

export function addActionItem(minuteId: string, text: string, assignee = '我', now = Date.now()): void {
  const trimmed = text.trim()
  if (!trimmed) return
  const item: ActionItem = {
    id: generateActionItemId(now),
    text: trimmed,
    assignee: assignee.trim() || '我',
    done: false,
  }
  mapMinute(minuteId, (minute) => ({ ...minute, actionItems: [...minute.actionItems, item] }))
}

export function updateActionItem(
  minuteId: string,
  itemId: string,
  patch: Partial<Pick<ActionItem, 'text' | 'assignee' | 'done'>>,
): void {
  mapMinute(minuteId, (minute) => ({
    ...minute,
    actionItems: minute.actionItems.map((item) =>
      item.id === itemId
        ? {
            ...item,
            ...(patch.text !== undefined ? { text: patch.text.trim() || item.text } : {}),
            ...(patch.assignee !== undefined ? { assignee: patch.assignee.trim() || item.assignee } : {}),
            ...(patch.done !== undefined ? { done: patch.done } : {}),
          }
        : item,
    ),
  }))
}

export function toggleActionItem(minuteId: string, itemId: string): void {
  const minute = minuteStore.state.minutes.find((item) => item.id === minuteId)
  const action = minute?.actionItems.find((item) => item.id === itemId)
  if (!action) return
  updateActionItem(minuteId, itemId, { done: !action.done })
}

export function removeActionItem(minuteId: string, itemId: string): void {
  mapMinute(minuteId, (minute) => ({
    ...minute,
    actionItems: minute.actionItems.filter((item) => item.id !== itemId),
  }))
}

/** 重置内存状态，从 localStorage 重新水合（createInitialState 会读取它）。 */
export function resetMinuteStore(): void {
  minuteStore.setState(() => createInitialState())
}
