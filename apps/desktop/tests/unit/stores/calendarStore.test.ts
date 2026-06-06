import { beforeEach, describe, expect, it } from 'vitest'
import {
  addEvent,
  calendarStore,
  removeEvent,
  reschedule,
  resetCalendarStore,
  setRsvp,
} from '@/features/calendar/stores/calendarStore'
import { CALENDAR_STORAGE_KEY } from '@/features/calendar/types/event'

describe('calendarStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetCalendarStore()
  })

  it('starts empty without any seeded mock events', () => {
    expect(calendarStore.state.events).toEqual([])
  })

  it('persists a created event across a reload', () => {
    const event = addEvent({
      id: 'event-1',
      title: '产品周会',
      date: '2026-05-29',
      time: '09:30',
      endTime: '10:30',
      participants: '产品团队',
    })

    expect(event.rsvpStatus).toBe('已创建')
    expect(calendarStore.state.events).toHaveLength(1)

    // resetCalendarStore re-hydrates from localStorage, simulating a reload
    resetCalendarStore()
    expect(calendarStore.state.events).toHaveLength(1)
    expect(calendarStore.state.events[0]).toMatchObject({
      id: 'event-1',
      title: '产品周会',
      date: '2026-05-29',
      time: '09:30',
      endTime: '10:30',
      participants: '产品团队',
    })
  })

  it('defaults participants to 我 when none provided', () => {
    const event = addEvent({ title: '专注时间', date: '2026-05-29', time: '10:00' })
    expect(event.participants).toBe('我')
  })

  it('rejects an event with an empty title', () => {
    expect(() => addEvent({ title: '   ', date: '2026-05-29', time: '10:00' })).toThrow()
    expect(calendarStore.state.events).toEqual([])
  })

  it('updates rsvp status and persists it', () => {
    addEvent({ id: 'event-2', title: '设计评审', date: '2026-05-29', time: '14:00' })
    setRsvp('event-2', '已接受')

    resetCalendarStore()
    expect(calendarStore.state.events[0].rsvpStatus).toBe('已接受')
  })

  it('reschedules an event and persists the new slot', () => {
    addEvent({ id: 'event-3', title: '1:1 沟通', date: '2026-05-29', time: '11:00', endTime: '11:30' })
    reschedule('event-3', { date: '2026-05-30', time: '15:00', endTime: '16:00' })

    resetCalendarStore()
    expect(calendarStore.state.events[0]).toMatchObject({ date: '2026-05-30', time: '15:00', endTime: '16:00' })
  })

  it('removes an event and persists the removal', () => {
    addEvent({ id: 'event-4', title: '发布准备会', date: '2026-05-29', time: '15:00' })
    removeEvent('event-4')

    resetCalendarStore()
    expect(calendarStore.state.events).toEqual([])
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

    resetCalendarStore()
    expect(calendarStore.state.events).toHaveLength(1)
    expect(calendarStore.state.events[0].id).toBe('good')
  })
})
