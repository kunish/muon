import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationSettings from '@/features/settings/components/NotificationSettings.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

const requestPermission = vi.fn()

const SwitchStub = {
  props: {
    modelValue: Boolean,
    disabled: Boolean,
  },
  emits: ['update:modelValue'],
  template: `
    <button
      v-bind="$attrs"
      type="button"
      :data-checked="modelValue"
      :disabled="disabled"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `,
}

describe('notification settings', () => {
  beforeEach(() => {
    localStorage.clear()
    requestPermission.mockReset()
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'Notification')
  })

  it('lets users tune notification channels, sound, and badge count', async () => {
    const store = useSettingsStore()
    const wrapper = mount(NotificationSettings, {
      global: {
        stubs: {
          Switch: SwitchStub,
        },
      },
    })

    expect(wrapper.get('[data-testid="settings-notification-channel-summary"]').text()).toContain('4')

    await wrapper.get('[data-testid="settings-channel-approvals"]').trigger('click')
    await wrapper.get('[data-testid="settings-notification-sound"]').trigger('click')
    await wrapper.get('[data-testid="settings-badge-count"]').trigger('click')

    expect(store.notificationChannels.approvals).toBe(false)
    expect(store.notificationSound).toBe(false)
    expect(store.badgeCount).toBe(false)
    expect(wrapper.get('[data-testid="settings-notification-channel-summary"]').text()).toContain('3')
  })

  it('requests system notification permission when notifications are enabled', async () => {
    class FakeNotification {
      static permission: NotificationPermission = 'default'
      static requestPermission = requestPermission.mockResolvedValue('granted')
    }
    Object.defineProperty(globalThis, 'Notification', {
      configurable: true,
      value: FakeNotification,
    })
    const store = useSettingsStore()
    store.notificationsEnabled = false
    const wrapper = mount(NotificationSettings, {
      global: {
        stubs: {
          Switch: SwitchStub,
        },
      },
    })

    await wrapper.get('[data-testid="settings-enable-notifications"]').trigger('click')

    expect(store.notificationsEnabled).toBe(true)
    expect(requestPermission).toHaveBeenCalledTimes(1)
  })
})
