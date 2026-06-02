import type { CalendarEvent, EventRecurrence } from '../types/event'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'
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

function loadStateEffect(): DesktopEffect<LoadedCalendarState> {
  return fromSync(() => {
    const raw = localStorage.getItem(CALENDAR_STORAGE_KEY)
    if (!raw) return { events: [], normalized: false }

    const parsed = JSON.parse(raw) as Partial<PersistedCalendarState>
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) return { events: [], normalized: false }

    return normalizePersistedEvents(parsed.events)
  }).pipe(Effect.catchAll(() => Effect.succeed({ events: [], normalized: false })))
}

function persistStateEffect(events: CalendarEvent[]): DesktopEffect<void> {
  const payload: PersistedCalendarState = { version: 1, events }
  return fromSync(() => localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(payload))).pipe(
    Effect.catchAll((err) => fromSync(() => console.warn('[calendarStore] Failed to persist events:', err))),
  )
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const hydrated = ref(false)

  function persist() {
    runDesktopSync(persistStateEffect(events.value))
  }

  function hydrate() {
    const { events: loaded, normalized } = runDesktopSync(loadStateEffect())
    events.value = loaded
    hydrated.value = true
    if (normalized) persist()
  }

  function addEvent(input: AddEventInput): CalendarEvent {
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

    events.value = [event, ...events.value]
    persist()
    return event
  }

  function updateEvent(id: string, patch: Partial<Omit<CalendarEvent, 'id'>>) {
    const index = events.value.findIndex((event) => event.id === id)
    if (index < 0) return
    events.value = events.value.map((event) => (event.id === id ? { ...event, ...patch } : event))
    persist()
  }

  function setRsvp(id: string, rsvpStatus: string) {
    updateEvent(id, { rsvpStatus })
  }

  function reschedule(id: string, input: RescheduleInput) {
    updateEvent(id, { date: input.date, time: input.time, endTime: input.endTime || undefined })
  }

  function removeEvent(id: string) {
    const next = events.value.filter((event) => event.id !== id)
    if (next.length === events.value.length) return
    events.value = next
    persist()
  }

  /**
   * 用一次订阅同步的结果替换该订阅的所有事件（按 `sub:<subId>:` 前缀去重，
   * 使重复同步幂等，不产生重复事件）。
   */
  function replaceSubscriptionEvents(subId: string, inputs: AddEventInput[]) {
    const prefix = `sub:${subId}:`
    const kept = events.value.filter((event) => !event.id.startsWith(prefix))
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
    events.value = [...fresh, ...kept]
    persist()
  }

  hydrate()

  return {
    events,
    hydrated,
    hydrate,
    addEvent,
    updateEvent,
    setRsvp,
    reschedule,
    removeEvent,
    replaceSubscriptionEvents,
  }
})
