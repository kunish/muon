import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useCalendarStore } from '@/features/calendar/stores/calendarStore'
import { CALENDAR_STORAGE_KEY } from '@/features/calendar/types/event'

function reloadStore() {
  setActivePinia(createPinia())
  return useCalendarStore()
}

describe('calendarStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('starts empty without any seeded mock events', () => {
    const store = useCalendarStore()
    expect(store.events).toEqual([])
  })

  it('persists a created event across a reload', () => {
    const store = useCalendarStore()
    const event = store.addEvent({
      id: 'event-1',
      title: '产品周会',
      date: '2026-05-29',
      time: '09:30',
      endTime: '10:30',
      participants: '产品团队',
    })

    expect(event.rsvpStatus).toBe('已创建')
    expect(store.events).toHaveLength(1)

    const reloaded = reloadStore()
    expect(reloaded.events).toHaveLength(1)
    expect(reloaded.events[0]).toMatchObject({
      id: 'event-1',
      title: '产品周会',
      date: '2026-05-29',
      time: '09:30',
      endTime: '10:30',
      participants: '产品团队',
    })
  })

  it('defaults participants to 我 when none provided', () => {
    const store = useCalendarStore()
    const event = store.addEvent({ title: '专注时间', date: '2026-05-29', time: '10:00' })
    expect(event.participants).toBe('我')
  })

  it('rejects an event with an empty title', () => {
    const store = useCalendarStore()
    expect(() => store.addEvent({ title: '   ', date: '2026-05-29', time: '10:00' })).toThrow()
    expect(store.events).toEqual([])
  })

  it('updates rsvp status and persists it', () => {
    const store = useCalendarStore()
    store.addEvent({ id: 'event-2', title: '设计评审', date: '2026-05-29', time: '14:00' })
    store.setRsvp('event-2', '已接受')

    expect(reloadStore().events[0].rsvpStatus).toBe('已接受')
  })

  it('reschedules an event and persists the new slot', () => {
    const store = useCalendarStore()
    store.addEvent({ id: 'event-3', title: '1:1 沟通', date: '2026-05-29', time: '11:00', endTime: '11:30' })
    store.reschedule('event-3', { date: '2026-05-30', time: '15:00', endTime: '16:00' })

    expect(reloadStore().events[0]).toMatchObject({ date: '2026-05-30', time: '15:00', endTime: '16:00' })
  })

  it('removes an event and persists the removal', () => {
    const store = useCalendarStore()
    store.addEvent({ id: 'event-4', title: '发布准备会', date: '2026-05-29', time: '15:00' })
    store.removeEvent('event-4')

    expect(reloadStore().events).toEqual([])
  })

  it('drops invalid persisted events when hydrating', () => {
    localStorage.setItem(
      CALENDAR_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        events: [
          {
            id: 'good',
            title: 'Valid',
            date: '2026-05-29',
            time: '09:00',
            participants: '我',
            color: 'blue',
            rsvpStatus: '已创建',
          },
          {
            id: 'bad',
            title: 'Broken',
            date: 'not-a-date',
            time: '09:00',
            participants: '我',
            color: 'blue',
            rsvpStatus: '已创建',
          },
        ],
      }),
    )

    const store = useCalendarStore()
    expect(store.events).toHaveLength(1)
    expect(store.events[0].id).toBe('good')
  })
})
