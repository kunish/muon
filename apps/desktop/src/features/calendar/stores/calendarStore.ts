import type { CalendarEvent, EventRecurrence } from '../types/event'
import { Store } from '@tanstack/vue-store'
import { CALENDAR_STORAGE_KEY, generateEventId, isValidCalendarEvent } from '../types/event'

interface PersistedCalendarState {
  version: 1
  events: CalendarEvent[]
}

interface LoadedCalendarState {
  events: CalendarEvent[]
  normalized: boolean
}

interface AddEventInput {
  id?: string
  title: string
  date: string
  time: string
  endTime?: string
  participants?: string
  color?: string
  description?: string
  rsvpStatus?: string
  meetingUrl?: string
  location?: string
  recurrence?: EventRecurrence
  reminderMinutes?: number
  now?: number
}

interface RescheduleInput {
  date: string
  time: string
  endTime?: string
}

function normalizePersistedEvents(events: unknown[]): LoadedCalendarState {
  const deduped = new Map<string, CalendarEvent>()
  let normalized = false

  for (const event of events) {
    if (!isValidCalendarEvent(event)) {
      normalized = true
      continue
    }
    if (deduped.has(event.id)) normalized = true
    deduped.set(event.id, event)
  }

  return { events: [...deduped.values()], normalized }
}

function loadState(): LoadedCalendarState {
  try {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY)
    if (!raw) return { events: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedCalendarState>
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return { events: [], normalized: false }

    return normalizePersistedEvents(parsed.events)
  } catch {
    return { events: [], normalized: false }
  }
}

function persistEvents(events: CalendarEvent[]): void {
  const payload: PersistedCalendarState = { version: 1, events }
  try {
    localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(payload))
  } catch (err) {
    console.warn('[calendarStore] Failed to persist events:', err)
  }
}

export interface CalendarState {
  /** User-created and subscription-synced events, persisted to localStorage (version-1 envelope). */
  events: CalendarEvent[]
  hydrated: boolean
}

function createInitialState(): CalendarState {
  const { events, normalized } = loadState()
  // Re-persist immediately if we dropped invalid/duplicate events while loading,
  // so the on-disk envelope matches the in-memory snapshot.
  if (normalized) persistEvents(events)
  return { events, hydrated: true }
}

export const calendarStore = new Store<CalendarState>(createInitialState())

/** Reactive read of the event list — consumers select this via `useSelector`. */
export function selectEvents(state: CalendarState): CalendarEvent[] {
  return state.events
}

/** Re-read persisted events from localStorage into the store. */
export function hydrate(): void {
  const { events, normalized } = loadState()
  calendarStore.setState((s) => ({ ...s, events, hydrated: true }))
  if (normalized) persistEvents(events)
}

export function addEvent(input: AddEventInput): CalendarEvent {
  const title = input.title.trim()
  if (!title) throw new Error('Event title is required')

  const now = input.now ?? Date.now()
  const event: CalendarEvent = {
    id: input.id ?? generateEventId(now),
    title,
    date: input.date,
    time: input.time,
    endTime: input.endTime || undefined,
    participants: input.participants?.trim() || '我',
    color: input.color || 'blue',
    description: input.description?.trim() || undefined,
    rsvpStatus: input.rsvpStatus || '已创建',
    meetingUrl: input.meetingUrl?.trim() || undefined,
    location: input.location?.trim() || undefined,
    recurrence: input.recurrence,
    reminderMinutes: input.reminderMinutes,
  }

  if (!isValidCalendarEvent(event)) throw new Error('Invalid calendar event')

  calendarStore.setState((s) => ({ ...s, events: [event, ...s.events] }))
  persistEvents(calendarStore.state.events)
  return event
}

export function updateEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id'>>): void {
  const index = calendarStore.state.events.findIndex((event) => event.id === id)
  if (index < 0) return
  calendarStore.setState((s) => ({
    ...s,
    events: s.events.map((event) => (event.id === id ? { ...event, ...patch } : event)),
  }))
  persistEvents(calendarStore.state.events)
}

export function setRsvp(id: string, rsvpStatus: string): void {
  updateEvent(id, { rsvpStatus })
}

export function reschedule(id: string, input: RescheduleInput): void {
  updateEvent(id, { date: input.date, time: input.time, endTime: input.endTime || undefined })
}

export function removeEvent(id: string): void {
  const next = calendarStore.state.events.filter((event) => event.id !== id)
  if (next.length === calendarStore.state.events.length) return
  calendarStore.setState((s) => ({ ...s, events: next }))
  persistEvents(calendarStore.state.events)
}

/**
 * 用一次订阅同步的结果替换该订阅的所有事件（按 `sub:<subId>:` 前缀去重，
 * 使重复同步幂等，不产生重复事件）。
 */
export function replaceSubscriptionEvents(subId: string, inputs: AddEventInput[]): void {
  const prefix = `sub:${subId}:`
  const kept = calendarStore.state.events.filter((event) => !event.id.startsWith(prefix))
  const now = Date.now()
  const fresh: CalendarEvent[] = []
  for (const input of inputs) {
    const title = input.title.trim()
    if (!title) continue
    const event: CalendarEvent = {
      id: `${prefix}${input.id ?? generateEventId(now)}`,
      title,
      date: input.date,
      time: input.time,
      endTime: input.endTime || undefined,
      participants: input.participants?.trim() || '订阅日历',
      color: input.color || 'sky',
      description: input.description?.trim() || undefined,
      rsvpStatus: input.rsvpStatus || '已订阅',
    }
    if (isValidCalendarEvent(event)) fresh.push(event)
  }
  calendarStore.setState((s) => ({ ...s, events: [...fresh, ...kept] }))
  persistEvents(calendarStore.state.events)
}

/** Reset in-memory state, re-hydrating from localStorage (createInitialState reads it). */
export function resetCalendarStore(): void {
  calendarStore.setState(() => createInitialState())
}
