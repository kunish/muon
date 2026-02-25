import { describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

describe('settingsStore', () => {
  it('should have default values', () => {
    const store = useSettingsStore()

    expect(store.theme).toBe('system')
    expect(store.locale).toBe('zh')
    expect(store.notificationsEnabled).toBe(true)
    expect(store.closeToTray).toBe(true)
    expect(store.autoLaunch).toBe(false)
  })

  it('should update theme', () => {
    const store = useSettingsStore()
    store.theme = 'dark'

    expect(store.theme).toBe('dark')
  })

  it('should update locale', () => {
    const store = useSettingsStore()
    store.locale = 'en'

    expect(store.locale).toBe('en')
  })

  it('should toggle notifications', () => {
    const store = useSettingsStore()
    store.notificationsEnabled = false

    expect(store.notificationsEnabled).toBe(false)
  })
})
