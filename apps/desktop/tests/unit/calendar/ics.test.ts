import type { CalendarEvent } from '@/features/calendar/types/event'
import { describe, expect, it } from 'vitest'
import { eventsToIcs, parseIcs } from '@/features/calendar/lib/ics'

const sample: CalendarEvent = {
  id: 'event:1',
  date: '2026-05-30',
  time: '10:00',
  endTime: '11:00',
  title: 'Design Review',
  participants: '我',
  color: 'blue',
  description: 'Q3 plan',
  rsvpStatus: '已创建',
}

describe('calendar ics', () => {
  it('exports events as a VCALENDAR with VEVENT fields', () => {
    const ics = eventsToIcs([sample], 0)
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('SUMMARY:Design Review')
    expect(ics).toContain('DTSTART:20260530T100000')
    expect(ics).toContain('DTEND:20260530T110000')
    expect(ics).toContain('END:VCALENDAR')
  })

  it('round-trips exported events back through the parser', () => {
    const parsed = parseIcs(eventsToIcs([sample], 0))
    expect(parsed).toEqual([
      {
        title: 'Design Review',
        date: '2026-05-30',
        time: '10:00',
        endTime: '11:00',
        description: 'Q3 plan',
      },
    ])
  })

  it('parses an external .ics with TZID params, escaping and folded lines', () => {
    const external = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'DTSTART;TZID=Asia/Shanghai:20260601T140000',
      'DTEND;TZID=Asia/Shanghai:20260601T150000',
      'SUMMARY:Weekly sync\\, room A',
      'DESCRIPTION:line one\\nline ',
      ' two',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

    expect(parseIcs(external)).toEqual([
      {
        title: 'Weekly sync, room A',
        date: '2026-06-01',
        time: '14:00',
        endTime: '15:00',
        description: 'line one\nline two',
      },
    ])
  })

  it('ignores VEVENTs without a start time or title', () => {
    const incomplete = ['BEGIN:VCALENDAR', 'BEGIN:VEVENT', 'SUMMARY:No start', 'END:VEVENT', 'END:VCALENDAR'].join(
      '\r\n',
    )
    expect(parseIcs(incomplete)).toEqual([])
  })
})
