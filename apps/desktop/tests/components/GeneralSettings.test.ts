import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import GeneralSettings from '@/features/settings/components/GeneralSettings.vue'
import { resetSettingsStore, settingsStore } from '@/features/settings/stores/settingsStore'

const setAnalyticsEnabled = vi.hoisted(() => vi.fn())

vi.mock('@/shared/lib/analytics', () => ({
  setAnalyticsEnabled,
}))

const SwitchStub = {
  props: {
    modelValue: Boolean,
  },
  emits: ['update:modelValue'],
  template: `
    <button
      type="button"
      :data-checked="modelValue"
      @click="$emit('update:modelValue', !modelValue)"
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
    resetSettingsStore()
    setAnalyticsEnabled.mockClear()
  })

  it('lets users change launch, tray, and analytics preferences', async () => {
    const wrapper = mountGeneralSettings()

    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')
    await wrapper.findAll('button')[2].trigger('click')

    expect(settingsStore.state.autoLaunch).toBe(true)
    expect(settingsStore.state.closeToTray).toBe(false)
    expect(settingsStore.state.analyticsEnabled).toBe(false)
    expect(setAnalyticsEnabled).toHaveBeenLastCalledWith(false)
  })
})
