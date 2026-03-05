import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { __resetUnifiedInboxForTests } from '@/features/chat/composables/useUnifiedInbox'
import { useDeferStore } from '@/features/chat/stores/deferStore'
import { useInboxStore } from '@/features/chat/stores/inboxStore'

describe('UnifiedInboxPanel', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetUnifiedInboxForTests()
  })

  it('shows all inbox item types and supports all/type filters', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    expect(wrapper.find('[data-testid="inbox-filter-all"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inbox-filter-mention"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inbox-filter-priority-unread"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="inbox-filter-reply-needed"]').exists()).toBe(true)

    const allItems = wrapper.findAll('[data-testid^="inbox-item-"]')
    expect(allItems.length).toBeGreaterThan(0)

    const store = useInboxStore()
    store.setFilter('mention')
    await nextTick()
    expect(wrapper.findAll('[data-testid^="inbox-item-"]').every(node => node.attributes('data-testid') === 'inbox-item-mention')).toBe(true)

    store.setFilter('priority-unread')
    await nextTick()
    expect(wrapper.findAll('[data-testid^="inbox-item-"]').every(node => node.attributes('data-testid') === 'inbox-item-priority-unread')).toBe(true)

    store.setFilter('reply-needed')
    await nextTick()
    expect(wrapper.findAll('[data-testid^="inbox-item-"]').every(node => node.attributes('data-testid') === 'inbox-item-reply-needed')).toBe(true)

    store.setFilter('all')
    await nextTick()
    expect(wrapper.findAll('[data-testid^="inbox-item-"]').length).toBeGreaterThanOrEqual(allItems.length)
  })

  it('marks selected items processed and updates visible list immediately', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const selectAllButton = wrapper.find('[data-testid="inbox-select-all"]')
    await selectAllButton.trigger('click')
    await nextTick()

    const selectedIds = wrapper
      .findAll('input[data-testid^="inbox-select-"]')
      .map((node) => {
        const testId = node.attributes('data-testid')
        return testId ? testId.replace('inbox-select-', '') : ''
      })
      .filter(Boolean)

    expect(selectedIds.length).toBeGreaterThan(0)

    await wrapper.find('[data-testid="inbox-mark-processed"]').trigger('click')
    await nextTick()

    for (const id of selectedIds) {
      expect(wrapper.find(`[data-testid="inbox-select-${id}"]`).exists()).toBe(false)
    }
  })

  it('emits jump event with roomId/eventId when clicking an item', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const jumpButton = wrapper.find('[data-testid^="inbox-jump-"]')
    expect(jumpButton.exists()).toBe(true)

    await jumpButton.trigger('click')
    const emitted = wrapper.emitted('jump')
    expect(emitted).toBeTruthy()
    expect(emitted?.[0]?.[0]).toMatchObject({
      roomId: expect.any(String),
      eventId: expect.any(String),
    })
  })

  it('supports defer quick presets from inbox item', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const firstItem = wrapper.find('[data-testid^="inbox-jump-"]')
    expect(firstItem.exists()).toBe(true)
    const firstItemTestId = firstItem.attributes('data-testid') || ''
    const itemId = firstItemTestId.replace('inbox-jump-', '')

    const deferTrigger = wrapper.find(`[data-testid="inbox-defer-trigger-${itemId}"]`)
    expect(deferTrigger.exists()).toBe(true)
    await deferTrigger.trigger('click')
    await nextTick()

    await wrapper.find(`[data-testid="inbox-defer-preset-1h-${itemId}"]`).trigger('click')
    await nextTick()

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    const firstDeferred = deferStore.activeItems[0]!
    expect(firstDeferred).toMatchObject({
      id: `inbox:${itemId}:1h`,
      status: 'deferred',
    })
    expect(firstDeferred.dueAt).toBeGreaterThan(firstDeferred.createdAt)
  })

  it('supports custom defer time from inbox item', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const firstItem = wrapper.find('[data-testid^="inbox-jump-"]')
    expect(firstItem.exists()).toBe(true)
    const firstItemTestId = firstItem.attributes('data-testid') || ''
    const itemId = firstItemTestId.replace('inbox-jump-', '')
    const customDue = new Date('2026-03-06T10:30:00')

    await wrapper.find(`[data-testid="inbox-defer-trigger-${itemId}"]`).trigger('click')
    await nextTick()
    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()

    const input = wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`)
    expect(input.exists()).toBe(true)
    await input.setValue('2026-03-06T10:30')
    await wrapper.find(`[data-testid="inbox-defer-custom-submit-${itemId}"]`).trigger('click')
    await nextTick()

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    const firstDeferred = deferStore.activeItems[0]!
    expect(firstDeferred).toMatchObject({
      id: `inbox:${itemId}:custom`,
      status: 'deferred',
    })
    expect(Math.abs(firstDeferred.dueAt - customDue.getTime())).toBeLessThan(60_000)
  })

  it('adds created defer item into active queue with valid dueAt', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const firstItem = wrapper.find('[data-testid^="inbox-jump-"]')
    expect(firstItem.exists()).toBe(true)
    const firstItemTestId = firstItem.attributes('data-testid') || ''
    const itemId = firstItemTestId.replace('inbox-jump-', '')

    await wrapper.find(`[data-testid="inbox-defer-trigger-${itemId}"]`).trigger('click')
    await nextTick()
    await wrapper.find(`[data-testid="inbox-defer-preset-tomorrow-${itemId}"]`).trigger('click')
    await nextTick()

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    const firstDeferred = deferStore.activeItems[0]!
    expect(firstDeferred.dueAt).toBeGreaterThan(Date.now())
  })
})
