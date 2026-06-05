import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AppearanceSettings from '@/features/settings/components/AppearanceSettings.vue'
import { resetSettingsStore, selectMessageFontScaleValue, settingsStore } from '@/shared/stores/settingsStore'

function mountSettings() {
  return mount(AppearanceSettings, {
    global: {
      stubs: {
        Select: true,
        SelectContent: true,
        SelectItem: true,
        SelectTrigger: true,
        SelectValue: true,
        Check: true,
      },
    },
  })
}

describe('appearance settings message font size', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })

  it('defaults to standard and renders all four presets', () => {
    expect(settingsStore.state.messageFontScale).toBe('standard')

    const options = mountSettings().findAll('[data-testid="font-scale-option"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['small', 'standard', 'large', 'xlarge'])
  })

  it('updates the stored font scale when a preset is clicked', async () => {
    const wrapper = mountSettings()

    const large = wrapper
      .findAll('[data-testid="font-scale-option"]')
      .find((option) => option.attributes('data-value') === 'large')
    await large!.trigger('click')

    expect(settingsStore.state.messageFontScale).toBe('large')
    expect(selectMessageFontScaleValue(settingsStore.state)).toBeCloseTo(1.15)
  })
})
