export const CALENDAR_STORAGE_KEY = 'muon.calendar.events.v1'

export type RecurrenceFreq = 'daily' | 'weekly' | 'monthly'

export interface EventRecurrence {
  freq: RecurrenceFreq
  /** 间隔（每 N 天/周/月），默认 1 */
  interval?: number
  /** 总发生次数（含首次） */
  count?: number
  /** 截止日期（含），YYYY-MM-DD */
  until?: string
}

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
  /** 会议链接（内部 call 链接或外部会议 URL），用于一键入会 */
  meetingUrl?: string
  /** 地点（线下会议室或线上标注） */
  location?: string
  /** 重复规则（RRULE 简化版）；不设则为单次日程 */
  recurrence?: EventRecurrence
  /** 提前提醒分钟数（开会前 N 分钟桌面提醒）；不设则不提醒 */
  reminderMinutes?: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^\d{2}:\d{2}$/
const RECURRENCE_FREQS: readonly RecurrenceFreq[] = ['daily', 'weekly', 'monthly']

function isValidRecurrence(value: unknown): value is EventRecurrence {
  if (value === undefined) return true
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<EventRecurrence>
  return (
    typeof candidate.freq === 'string' &&
    RECURRENCE_FREQS.includes(candidate.freq as RecurrenceFreq) &&
    (candidate.interval === undefined || (typeof candidate.interval === 'number' && candidate.interval >= 1)) &&
    (candidate.count === undefined || (typeof candidate.count === 'number' && candidate.count >= 1)) &&
    (candidate.until === undefined || (typeof candidate.until === 'string' && DATE_RE.test(candidate.until)))
  )
}

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
    typeof candidate.rsvpStatus === 'string' &&
    (candidate.meetingUrl === undefined || typeof candidate.meetingUrl === 'string') &&
    (candidate.location === undefined || typeof candidate.location === 'string') &&
    isValidRecurrence(candidate.recurrence) &&
    (candidate.reminderMinutes === undefined || typeof candidate.reminderMinutes === 'number')
  )
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addInterval(baseDate: string, freq: RecurrenceFreq, steps: number): string {
  const [year, month, day] = baseDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (freq === 'daily') date.setDate(date.getDate() + steps)
  else if (freq === 'weekly') date.setDate(date.getDate() + steps * 7)
  else date.setMonth(date.getMonth() + steps)
  return formatDateKey(date)
}

const MAX_RECURRENCE_ITERATIONS = 1000
const DEFAULT_RECURRENCE_CAP = 366

/**
 * 把含重复规则的事件展开为 [rangeStart, rangeEnd] 内的具体日期实例（保留基础 id，
 * 因此 RSVP/改期/删除按整个系列处理）；非重复事件落在区间内则原样返回。
 */
export function expandRecurringEvents(events: CalendarEvent[], rangeStart: string, rangeEnd: string): CalendarEvent[] {
  const result: CalendarEvent[] = []
  for (const event of events) {
    if (!event.recurrence) {
      if (event.date >= rangeStart && event.date <= rangeEnd) result.push(event)
      continue
    }

    const { freq, interval = 1, count, until } = event.recurrence
    const cap = count ?? DEFAULT_RECURRENCE_CAP
    let occurrences = 0
    for (let i = 0; i < MAX_RECURRENCE_ITERATIONS && occurrences < cap; i += 1) {
      const occurrenceDate = i === 0 ? event.date : addInterval(event.date, freq, i * interval)
      if (until && occurrenceDate > until) break
      occurrences += 1
      if (occurrenceDate > rangeEnd) break
      if (occurrenceDate >= rangeStart) result.push({ ...event, date: occurrenceDate })
    }
  }
  return result
}

export function generateEventId(now: number): string {
  const suffix = Math.random().toString(36).slice(2, 10)
  return `event:${now}:${suffix}`
}
