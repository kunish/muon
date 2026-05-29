import type { CalendarEvent } from '../types/event'

/** 解析出的 iCalendar 事件（字段对齐 calendarStore.addEvent 的输入） */
export interface ParsedIcsEvent {
  title: string
  date: string
  time: string
  endTime?: string
  description?: string
}

function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function unescapeText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\')
}

/** date=YYYY-MM-DD, time=HH:mm → 20260530T100000（浮动本地时间） */
function toIcsDateTime(date: string, time: string): string {
  return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`
}

function toIcsStamp(now: number): string {
  // 使用调用方传入的时间戳，保持纯函数可测
  const d = new Date(now)
  const p = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  )
}

/** 把日历事件导出为 iCalendar(.ics)文本 */
export function eventsToIcs(events: CalendarEvent[], now: number): string {
  const stamp = toIcsStamp(now)
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//muon//calendar//EN', 'CALSCALE:GREGORIAN']
  for (const event of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.id}`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${toIcsDateTime(event.date, event.time)}`)
    if (event.endTime) lines.push(`DTEND:${toIcsDateTime(event.date, event.endTime)}`)
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** 解析 DTSTART/DTEND 的日期时间值（容忍带 TZID 参数、UTC Z、纯日期） */
function parseDateTime(value: string): { date: string; time: string } | null {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/)
  if (!match) return null
  const [, year, month, day, hour = '00', minute = '00'] = match
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}

/** 解析 iCalendar(.ics)文本为事件列表（按 RFC5545 折行展开） */
export function parseIcs(text: string): ParsedIcsEvent[] {
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '')
  const events: ParsedIcsEvent[] = []
  let current: Partial<ParsedIcsEvent> | null = null

  for (const line of unfolded.split('\n')) {
    if (line === 'BEGIN:VEVENT') {
      current = {}
      continue
    }
    if (line === 'END:VEVENT') {
      if (current?.title && current.date && current.time) {
        events.push({
          title: current.title,
          date: current.date,
          time: current.time,
          endTime: current.endTime,
          description: current.description,
        })
      }
      current = null
      continue
    }
    if (!current) continue

    const colon = line.indexOf(':')
    if (colon < 0) continue
    const key = line.slice(0, colon).split(';')[0]!.toUpperCase()
    const value = line.slice(colon + 1)

    if (key === 'SUMMARY') current.title = unescapeText(value)
    else if (key === 'DESCRIPTION') current.description = unescapeText(value)
    else if (key === 'DTSTART') {
      const parsed = parseDateTime(value)
      if (parsed) {
        current.date = parsed.date
        current.time = parsed.time
      }
    } else if (key === 'DTEND') {
      const parsed = parseDateTime(value)
      if (parsed) current.endTime = parsed.time
    }
  }

  return events
}
