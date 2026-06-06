import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import { addEvent, calendarStore, resetCalendarStore } from '@/features/calendar/stores/calendarStore'

function todayStr(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function seedTodayEvent() {
  addEvent({
    id: 'seed-1',
    title: '产品周会',
    date: todayStr(),
    time: '09:30',
    endTime: '10:30',
    participants: '产品团队',
  })
}

describe('calendar reschedule popover', () => {
  beforeEach(() => {
    localStorage.clear()
    resetCalendarStore()
    seedTodayEvent()
  })

  it('opens the popover, updates date/time/endTime, and reflects them in the detail panel', async () => {
    const wrapper = mount(CalendarPage)
    await nextTick()

    const eventButton = wrapper.find('[data-testid^="calendar-event-"]')
    expect(eventButton.exists()).toBe(true)
    await eventButton.trigger('click')
    await nextTick()

    const trigger = wrapper.find('[data-testid="event-reschedule-trigger"]')
    expect(trigger.exists()).toBe(true)
    await trigger.trigger('click')
    await nextTick()

    const dateInput = wrapper.find('[data-testid="reschedule-date"]')
    const startInput = wrapper.find('[data-testid="reschedule-start"]')
    const endInput = wrapper.find('[data-testid="reschedule-end"]')
    expect(dateInput.exists()).toBe(true)
    expect(startInput.exists()).toBe(true)
    expect(endInput.exists()).toBe(true)

    await dateInput.setValue('2026-06-01')
    await startInput.setValue('10:00')
    await endInput.setValue('11:00')

    const confirm = wrapper.find('[data-testid="reschedule-confirm"]')
    expect(confirm.attributes('disabled')).toBeUndefined()
    await confirm.trigger('click')
    await nextTick()

    const detailText = wrapper.find('[data-testid="event-detail-time"]').text()
    expect(detailText).toContain('2026-06-01')
    expect(detailText).toContain('10:00')
    expect(detailText).toContain('11:00')
  })

  it('persists the rescheduled slot across a reload', async () => {
    const wrapper = mount(CalendarPage)
    await nextTick()

    await wrapper.find('[data-testid^="calendar-event-"]').trigger('click')
    await wrapper.find('[data-testid="event-reschedule-trigger"]').trigger('click')
    await nextTick()

    await wrapper.find('[data-testid="reschedule-date"]').setValue('2026-06-01')
    await wrapper.find('[data-testid="reschedule-start"]').setValue('10:00')
    await wrapper.find('[data-testid="reschedule-end"]').setValue('11:00')
    await wrapper.find('[data-testid="reschedule-confirm"]').trigger('click')
    await nextTick()

    resetCalendarStore()
    expect(calendarStore.state.events[0]).toMatchObject({ date: '2026-06-01', time: '10:00', endTime: '11:00' })
  })

  it('disables confirm when end time is not after start time', async () => {
    const wrapper = mount(CalendarPage)
    await nextTick()
    await wrapper.find('[data-testid^="calendar-event-"]').trigger('click')
    await wrapper.find('[data-testid="event-reschedule-trigger"]').trigger('click')
    await nextTick()

    await wrapper.find('[data-testid="reschedule-date"]').setValue('2026-06-01')
    await wrapper.find('[data-testid="reschedule-start"]').setValue('10:00')
    await wrapper.find('[data-testid="reschedule-end"]').setValue('09:00')
    await nextTick()

    const confirm = wrapper.find('[data-testid="reschedule-confirm"]')
    expect(confirm.attributes('disabled')).toBeDefined()
  })
})
