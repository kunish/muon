import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { __resetUnifiedInboxForTests } from '@/features/chat/composables/useUnifiedInbox'
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
})
