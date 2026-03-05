import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import DeferQueuePanel from '@/features/chat/components/DeferQueuePanel.vue'
import { useDeferStore } from '@/features/chat/stores/deferStore'

describe('defer queue panel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('renders active defer items sorted by dueAt ascending', async () => {
    const deferStore = useDeferStore()
    deferStore.createDeferredItem({
      id: 'later',
      roomId: '!room:test',
      eventId: '$event-later',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-07T10:00:00Z') },
    })
    deferStore.createDeferredItem({
      id: 'earlier',
      roomId: '!room:test',
      eventId: '$event-earlier',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-06T09:00:00Z') },
    })

    const wrapper = mount(DeferQueuePanel)
    await nextTick()

    const rows = wrapper.findAll('[data-testid^="defer-active-item-"]')
    expect(rows.map(node => node.attributes('data-testid'))).toEqual([
      'defer-active-item-earlier',
      'defer-active-item-later',
    ])
  })

  it('moves completed and archived items from active into history', async () => {
    const deferStore = useDeferStore()
    deferStore.createDeferredItem({
      id: 'for-complete',
      roomId: '!room:test',
      eventId: '$event-complete',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-06T09:00:00Z') },
    })
    deferStore.createDeferredItem({
      id: 'for-archive',
      roomId: '!room:test',
      eventId: '$event-archive',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-06T10:00:00Z') },
    })

    const wrapper = mount(DeferQueuePanel)
    await nextTick()

    await wrapper.find('[data-testid="defer-complete-for-complete"]').trigger('click')
    await wrapper.find('[data-testid="defer-archive-for-archive"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="defer-active-item-for-complete"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="defer-active-item-for-archive"]').exists()).toBe(false)

    await wrapper.find('[data-testid="defer-history-tab"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="defer-history-item-for-complete"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="defer-history-item-for-archive"]').exists()).toBe(true)
  })

  it('shows only completed/archived items in history view', async () => {
    const deferStore = useDeferStore()
    deferStore.createDeferredItem({
      id: 'still-active',
      roomId: '!room:test',
      eventId: '$event-active',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-08T09:00:00Z') },
    })
    deferStore.createDeferredItem({
      id: 'done-item',
      roomId: '!room:test',
      eventId: '$event-done',
      reminder: { preset: 'custom', dueAt: Date.parse('2026-03-06T09:00:00Z') },
    })

    deferStore.markCompleted('done-item')

    const wrapper = mount(DeferQueuePanel)
    await nextTick()
    await wrapper.find('[data-testid="defer-history-tab"]').trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="defer-history-item-done-item"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="defer-history-item-still-active"]').exists()).toBe(false)
  })

  it('provides scrollable containers for active/history lists', async () => {
    const deferStore = useDeferStore()

    for (let index = 0; index < 20; index += 1) {
      deferStore.createDeferredItem({
        id: `active-${index}`,
        roomId: '!room:test',
        eventId: `$event-active-${index}`,
        reminder: { preset: 'custom', dueAt: Date.parse('2026-03-06T09:00:00Z') + index * 1000 },
      })
    }

    const wrapper = mount(DeferQueuePanel)
    await nextTick()

    const activeList = wrapper.get('[data-testid="defer-active-list"]')
    expect(activeList.classes()).toContain('overflow-y-auto')

    await wrapper.get('[data-testid="defer-complete-active-0"]').trigger('click')
    await nextTick()
    await wrapper.get('[data-testid="defer-history-tab"]').trigger('click')
    await nextTick()

    const historyList = wrapper.get('[data-testid="defer-history-list"]')
    expect(historyList.classes()).toContain('overflow-y-auto')
  })
})
