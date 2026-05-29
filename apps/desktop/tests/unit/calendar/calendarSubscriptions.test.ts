import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCalendarSubscriptions } from '@/features/calendar/composables/useCalendarSubscriptions'
import { useCalendarStore } from '@/features/calendar/stores/calendarStore'

const desktopFetch = vi.hoisted(() => vi.fn())
vi.mock('@/desktop/http', () => ({ fetch: desktopFetch }))

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:evt-1',
  'DTSTART:20260601T140000',
  'SUMMARY:Subscribed Event',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

function icsResponse(text: string) {
  return { ok: true, text: () => Promise.resolve(text) } as unknown as Response
}

describe('calendar subscriptions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    desktopFetch.mockReset()
  })

  it('replaceSubscriptionEvents is idempotent and removable', () => {
    const calendar = useCalendarStore()
    const base = { date: '2026-05-30', time: '10:00' }

    calendar.replaceSubscriptionEvents('s1', [{ title: 'A', ...base }])
    expect(calendar.events.filter((event) => event.title === 'A')).toHaveLength(1)

    // 重复同步不产生重复事件
    calendar.replaceSubscriptionEvents('s1', [
      { title: 'A', ...base },
      { title: 'B', ...base },
    ])
    expect(calendar.events.filter((event) => event.title === 'A')).toHaveLength(1)
    expect(calendar.events.some((event) => event.title === 'B')).toBe(true)

    calendar.replaceSubscriptionEvents('s1', [])
    expect(calendar.events.some((event) => event.title === 'A')).toBe(false)
  })

  it('fetches and merges a subscribed iCal calendar without duplicates on re-sync', async () => {
    desktopFetch.mockResolvedValue(icsResponse(ICS))
    const subscriptions = useCalendarSubscriptions()
    const calendar = useCalendarStore()

    expect(subscriptions.addSubscription('https://example.com/team.ics')).toBe(true)
    await subscriptions.syncAll()
    expect(calendar.events.filter((event) => event.title === 'Subscribed Event')).toHaveLength(1)

    await subscriptions.syncAll()
    expect(calendar.events.filter((event) => event.title === 'Subscribed Event')).toHaveLength(1)
  })

  it('removing a subscription clears its synced events', async () => {
    desktopFetch.mockResolvedValue(icsResponse(ICS))
    const subscriptions = useCalendarSubscriptions()
    const calendar = useCalendarStore()

    subscriptions.addSubscription('https://example.com/team.ics')
    await subscriptions.syncAll()
    expect(calendar.events.some((event) => event.title === 'Subscribed Event')).toBe(true)

    subscriptions.removeSubscription(subscriptions.subscriptions.value[0]!.id)
    expect(calendar.events.some((event) => event.title === 'Subscribed Event')).toBe(false)
  })

  it('does not add duplicate subscription URLs', () => {
    const subscriptions = useCalendarSubscriptions()
    expect(subscriptions.addSubscription('https://example.com/team.ics')).toBe(true)
    expect(subscriptions.addSubscription('https://example.com/team.ics')).toBe(false)
    expect(subscriptions.subscriptions.value).toHaveLength(1)
  })
})
