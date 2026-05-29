import { describe, expect, it } from 'vitest'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'

describe('settingsStore', () => {
  it('should have default values', () => {
    const store = useSettingsStore()

    expect(store.theme).toBe('system')
    expect(store.locale).toBe('zh')
    expect(store.notificationsEnabled).toBe(true)
    expect(store.notificationChannels).toEqual({
      approvals: true,
      calendar: true,
      mentions: true,
      messages: true,
    })
    expect(store.notificationSound).toBe(true)
    expect(store.badgeCount).toBe(true)
    expect(store.closeToTray).toBe(true)
    expect(store.autoLaunch).toBe(false)
    expect(store.messageFontScale).toBe('standard')
    expect(store.messageFontScaleValue).toBe(1)
  })

  it('maps each message font-size preset to its scale multiplier', () => {
    const store = useSettingsStore()

    store.messageFontScale = 'large'
    expect(store.messageFontScaleValue).toBeCloseTo(1.15)

    store.messageFontScale = 'small'
    expect(store.messageFontScaleValue).toBeCloseTo(0.875)
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

  it('updates notification channel preferences without dropping other channels', () => {
    const store = useSettingsStore()

    store.setNotificationChannel('approvals', false)

    expect(store.notificationChannels).toMatchObject({
      approvals: false,
      calendar: true,
      mentions: true,
      messages: true,
    })
    expect(store.activeNotificationChannelCount).toBe(3)
  })
})
