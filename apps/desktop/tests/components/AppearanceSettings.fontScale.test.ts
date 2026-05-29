import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import AppearanceSettings from '@/features/settings/components/AppearanceSettings.vue'
import { useSettingsStore } from '@/shared/stores/settingsStore'

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
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('defaults to standard and renders all four presets', () => {
    const store = useSettingsStore()
    expect(store.messageFontScale).toBe('standard')

    const options = mountSettings().findAll('[data-testid="font-scale-option"]')
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['small', 'standard', 'large', 'xlarge'])
  })

  it('updates the stored font scale when a preset is clicked', async () => {
    const store = useSettingsStore()
    const wrapper = mountSettings()

    const large = wrapper
      .findAll('[data-testid="font-scale-option"]')
      .find((option) => option.attributes('data-value') === 'large')
    await large!.trigger('click')

    expect(store.messageFontScale).toBe('large')
    expect(store.messageFontScaleValue).toBeCloseTo(1.15)
  })
})
