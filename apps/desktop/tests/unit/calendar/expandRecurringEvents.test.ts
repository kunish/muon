import type { CalendarEvent } from '@/features/calendar/types/event'
import { describe, expect, it } from 'vitest'
import { expandRecurringEvents } from '@/features/calendar/types/event'

function baseEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    date: '2026-06-01',
    time: '09:00',
    title: 'Standup',
    participants: '我',
    color: 'blue',
    rsvpStatus: '已创建',
    ...overrides,
  }
}

describe('expandRecurringEvents', () => {
  it('passes through a non-recurring event only when inside the range', () => {
    const event = baseEvent()
    expect(expandRecurringEvents([event], '2026-06-01', '2026-06-30')).toHaveLength(1)
    expect(expandRecurringEvents([event], '2026-07-01', '2026-07-31')).toHaveLength(0)
  })

  it('expands a daily recurrence within the range and keeps the base id', () => {
    const event = baseEvent({ recurrence: { freq: 'daily' } })
    const occurrences = expandRecurringEvents([event], '2026-06-01', '2026-06-03')
    expect(occurrences.map((o) => o.date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(occurrences.every((o) => o.id === 'evt-1')).toBe(true)
  })

  it('honors a weekly interval', () => {
    const event = baseEvent({ recurrence: { freq: 'weekly' } })
    const occurrences = expandRecurringEvents([event], '2026-06-01', '2026-06-30')
    expect(occurrences.map((o) => o.date)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
      '2026-06-29',
    ])
  })

  it('stops at the count limit', () => {
    const event = baseEvent({ recurrence: { freq: 'daily', count: 2 } })
    const occurrences = expandRecurringEvents([event], '2026-06-01', '2026-06-30')
    expect(occurrences.map((o) => o.date)).toEqual(['2026-06-01', '2026-06-02'])
  })

  it('stops at the until date', () => {
    const event = baseEvent({ recurrence: { freq: 'daily', until: '2026-06-02' } })
    const occurrences = expandRecurringEvents([event], '2026-06-01', '2026-06-30')
    expect(occurrences.map((o) => o.date)).toEqual(['2026-06-01', '2026-06-02'])
  })
})
