export const CALENDAR_STORAGE_KEY = 'muon.calendar.events.v1'

export interface CalendarEvent {
  id: string
  /** YYYY-MM-DD */
  date: string
  /** HH:mm */
  time: string
  title: string
  endTime?: string
  participants: string
  color: string
  description?: string
  rsvpStatus: string
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/

export function isValidCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<CalendarEvent>
  return (
    typeof candidate.id === 'string' &&
    !!candidate.id &&
    typeof candidate.title === 'string' &&
    typeof candidate.date === 'string' &&
    DATE_RE.test(candidate.date) &&
    typeof candidate.time === 'string' &&
    TIME_RE.test(candidate.time) &&
    (candidate.endTime === undefined || (typeof candidate.endTime === 'string' && TIME_RE.test(candidate.endTime))) &&
    typeof candidate.participants === 'string' &&
    typeof candidate.color === 'string' &&
    (candidate.description === undefined || typeof candidate.description === 'string') &&
    typeof candidate.rsvpStatus === 'string'
  )
}

export function generateEventId(now: number): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `event:${now}:${suffix}`
}
