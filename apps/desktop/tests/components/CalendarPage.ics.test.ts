import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import { addEvent, calendarStore, resetCalendarStore } from '@/features/calendar/stores/calendarStore'

const triggerBlobDownload = vi.hoisted(() => vi.fn())
vi.mock('@/shared/lib/download', () => ({ triggerBlobDownload }))

describe('calendar ics import/export', () => {
  beforeEach(() => {
    localStorage.removeItem('muon.calendar.events.v1')
    resetCalendarStore()
    triggerBlobDownload.mockClear()
  })

  it('exports the current events to an .ics download', async () => {
    addEvent({ title: 'Design Review', date: '2026-05-30', time: '10:00' })

    const wrapper = mount(CalendarPage)
    await wrapper.get('[data-testid="calendar-export-ics"]').trigger('click')

    expect(triggerBlobDownload).toHaveBeenCalledTimes(1)
    const [blob, filename] = triggerBlobDownload.mock.calls[0]
    expect(filename).toBe('muon-calendar.ics')
    expect(await (blob as Blob).text()).toContain('SUMMARY:Design Review')
  })

  it('imports events from a selected .ics file', async () => {
    const wrapper = mount(CalendarPage)

    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'DTSTART:20260601T140000',
      'SUMMARY:Imported Meeting',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    const file = new File([ics], 'cal.ics', { type: 'text/calendar' })
    const input = wrapper.get('[data-testid="calendar-ics-input"]')
    Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
    await input.trigger('change')
    await flushPromises()

    expect(calendarStore.state.events.some((event) => event.title === 'Imported Meeting')).toBe(true)
  })
})
