import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { __resetUnifiedInboxForTests } from '@/features/chat/composables/useUnifiedInbox'

describe('unifiedInboxPanel custom defer toggle', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    __resetUnifiedInboxForTests()
  })

  it('hides the custom defer input + confirm until the toggle is clicked', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const triggers = wrapper.findAll('[data-testid^="inbox-defer-trigger-"]')
    expect(triggers.length).toBeGreaterThan(0)
    const itemId = triggers[0]!.attributes('data-testid')!.replace('inbox-defer-trigger-', '')

    await triggers[0]!.trigger('click')
    await nextTick()

    expect(wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-submit-${itemId}"]`).exists()).toBe(false)

    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()

    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(true)
    expect(wrapper.find(`[data-testid="inbox-defer-custom-submit-${itemId}"]`).exists()).toBe(true)

    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
  })

  it('resets the custom defer expanded state when defer menu is closed and reopened', async () => {
    const wrapper = mount(UnifiedInboxPanel)
    await nextTick()

    const trigger = wrapper.find('[data-testid^="inbox-defer-trigger-"]')
    const itemId = trigger.attributes('data-testid')!.replace('inbox-defer-trigger-', '')

    await trigger.trigger('click')
    await nextTick()
    await wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(true)

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-toggle-${itemId}"]`).exists()).toBe(false)

    await trigger.trigger('click')
    await nextTick()
    expect(wrapper.find(`[data-testid="inbox-defer-custom-input-${itemId}"]`).exists()).toBe(false)
  })
})
