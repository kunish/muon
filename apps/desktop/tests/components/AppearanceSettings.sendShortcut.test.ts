import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import AppearanceSettings from '@/features/settings/components/AppearanceSettings.vue'
import { resetSettingsStore, settingsStore } from '@/shared/stores/settingsStore'

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

describe('appearance settings send-message shortcut', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })

  it('defaults to enter and renders both options', () => {
    expect(settingsStore.state.sendMessageShortcut).toBe('enter')

    const options = mountSettings().findAll('[data-testid="send-shortcut-option"]')
    expect(options).toHaveLength(2)
    expect(options.map((option) => option.attributes('data-value'))).toEqual(['enter', 'mod-enter'])
  })

  it('switches the stored shortcut when an option is clicked', async () => {
    const wrapper = mountSettings()

    const modEnter = wrapper
      .findAll('[data-testid="send-shortcut-option"]')
      .find((option) => option.attributes('data-value') === 'mod-enter')
    await modEnter!.trigger('click')
    expect(settingsStore.state.sendMessageShortcut).toBe('mod-enter')

    const enter = wrapper
      .findAll('[data-testid="send-shortcut-option"]')
      .find((option) => option.attributes('data-value') === 'enter')
    await enter!.trigger('click')
    expect(settingsStore.state.sendMessageShortcut).toBe('enter')
  })
})
