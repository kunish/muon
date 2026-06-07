import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AnnouncementsPage from '@/features/announcements/components/AnnouncementsPage.vue'
import {
  addAnnouncement,
  announcementStore,
  resetAnnouncementStore,
} from '@/features/announcements/stores/announcementStore'

const routeQuery = vi.hoisted(() => ({ value: {} as Record<string, string> }))
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: routeQuery.value }),
}))

describe('announcementsPage focus deep-link', () => {
  beforeEach(() => {
    localStorage.clear()
    resetAnnouncementStore()
    routeQuery.value = {}
  })

  it('expands and marks read the announcement named by ?focus on mount', async () => {
    addAnnouncement({ id: 'ann-focus-1', title: 'Halley 通知', body: '正文内容ABC', read: false })
    routeQuery.value = { focus: 'ann-focus-1' }

    const wrapper = mount(AnnouncementsPage)
    await nextTick()

    expect(wrapper.text()).toContain('正文内容ABC')
    expect(announcementStore.state.announcements[0].read).toBe(true)
  })

  it('does not expand anything when ?focus does not match', async () => {
    addAnnouncement({ id: 'ann-1', title: '其他通知', body: '隐藏正文XYZ', read: false })
    routeQuery.value = { focus: 'no-such-announcement' }

    const wrapper = mount(AnnouncementsPage)
    await nextTick()

    expect(wrapper.text()).not.toContain('隐藏正文XYZ')
    expect(announcementStore.state.announcements[0].read).toBe(false)
  })
})
