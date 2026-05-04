import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralSettings from '@/features/settings/components/GeneralSettings.vue'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

const setAnalyticsEnabled = vi.hoisted(() => vi.fn())

vi.mock('@/shared/lib/analytics', () => ({
  setAnalyticsEnabled,
}))

const SwitchStub = {
  props: {
    checked: Boolean,
  },
  emits: ['update:checked'],
  template: `
    <button
      type="button"
      :data-checked="checked"
      @click="$emit('update:checked', !checked)"
    />
  `,
}

function mountGeneralSettings() {
  return mount(GeneralSettings, {
    global: {
      stubs: {
        Switch: SwitchStub,
      },
    },
  })
}

describe('general settings', () => {
  beforeEach(() => {
    localStorage.clear()
    setAnalyticsEnabled.mockClear()
  })

  it('lets users change launch, tray, and analytics preferences', async () => {
    const store = useSettingsStore()
    const wrapper = mountGeneralSettings()

    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.findAll('button')[2].trigger('click')

    expect(store.autoLaunch).toBe(true)
    expect(store.closeToTray).toBe(false)
    expect(store.analyticsEnabled).toBe(false)
    expect(setAnalyticsEnabled).toHaveBeenLastCalledWith(false)
  })
})
