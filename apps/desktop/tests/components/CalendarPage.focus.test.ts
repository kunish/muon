import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CalendarPage from '@/features/calendar/components/CalendarPage.vue'
import { addEvent, resetCalendarStore } from '@/features/calendar/stores/calendarStore'

// 用可变 query 模拟 useRoute，验证 ?focus 深链选中日程。
const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
  useRouter: () => ({ push: vi.fn() }),
}))

describe('calendarPage focus deep-link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetCalendarStore()
    routeQuery.value = {}
  })

  it('selects the event named by ?focus on mount and shows it in the detail panel', async () => {
    addEvent({
      id: 'evt-focus-1',
      title: 'Pulsar 架构评审',
      date: '2026-07-15',
      time: '14:00',
      endTime: '15:00',
      participants: '我',
    })
    routeQuery.value = { focus: 'evt-focus-1' }

    const wrapper = mount(CalendarPage)
    await nextTick()

    expect(wrapper.text()).toContain('Pulsar 架构评审')
  })

  it('does nothing when ?focus does not match any event', async () => {
    addEvent({ id: 'evt-other', title: '其他日程', date: '2026-07-15', time: '14:00', participants: '我' })
    routeQuery.value = { focus: 'no-such-event' }

    const wrapper = mount(CalendarPage)
    await nextTick()

    // 不抛错、正常渲染日历框架
    expect(wrapper.text()).toContain('新建日程')
  })
})
