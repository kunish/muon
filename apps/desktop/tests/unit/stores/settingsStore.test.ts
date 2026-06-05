import { beforeEach, describe, expect, it } from 'vitest'
import {
  resetSettingsStore,
  selectActiveNotificationChannelCount,
  selectMessageFontScaleValue,
  setLocale,
  setMessageFontScale,
  setNotificationChannel,
  setNotificationsEnabled,
  setTheme,
  settingsStore,
} from '@/features/settings/stores/settingsStore'

describe('settingsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetSettingsStore()
  })

  it('should have default values', () => {
    expect(settingsStore.state.theme).toBe('system')
    expect(settingsStore.state.locale).toBe('zh')
    expect(settingsStore.state.notificationsEnabled).toBe(true)
    expect(settingsStore.state.notificationChannels).toEqual({
      approvals: true,
      calendar: true,
      mentions: true,
      messages: true,
    })
    expect(settingsStore.state.notificationSound).toBe(true)
    expect(settingsStore.state.badgeCount).toBe(true)
    expect(settingsStore.state.closeToTray).toBe(true)
    expect(settingsStore.state.autoLaunch).toBe(false)
    expect(settingsStore.state.messageFontScale).toBe('standard')
    expect(selectMessageFontScaleValue(settingsStore.state)).toBe(1)
  })

  it('maps each message font-size preset to its scale multiplier', () => {
    setMessageFontScale('large')
    expect(selectMessageFontScaleValue(settingsStore.state)).toBeCloseTo(1.15)

    setMessageFontScale('small')
    expect(selectMessageFontScaleValue(settingsStore.state)).toBeCloseTo(0.875)
  })

  it('should update theme', () => {
    setTheme('dark')
    expect(settingsStore.state.theme).toBe('dark')
  })

  it('should update locale', () => {
    setLocale('en')
    expect(settingsStore.state.locale).toBe('en')
  })

  it('should toggle notifications', () => {
    setNotificationsEnabled(false)
    expect(settingsStore.state.notificationsEnabled).toBe(false)
  })

  it('updates notification channel preferences without dropping other channels', () => {
    setNotificationChannel('approvals', false)

    expect(settingsStore.state.notificationChannels).toMatchObject({
      approvals: false,
      calendar: true,
      mentions: true,
      messages: true,
    })
    expect(selectActiveNotificationChannelCount(settingsStore.state)).toBe(3)
  })

  it('persists changes to localStorage in vueuse-compatible format', () => {
    setTheme('dark')
    setNotificationsEnabled(false)
    setNotificationChannel('approvals', false)

    expect(localStorage.getItem('muon_theme')).toBe('dark')
    expect(localStorage.getItem('muon_notifications')).toBe('false')
    expect(JSON.parse(localStorage.getItem('muon_notification_channels')!)).toMatchObject({ approvals: false })
  })

  it('hydrates from existing localStorage values', () => {
    localStorage.setItem('muon_theme', 'light')
    localStorage.setItem('muon_close_to_tray', 'false')
    resetSettingsStore()

    expect(settingsStore.state.theme).toBe('light')
    expect(settingsStore.state.closeToTray).toBe(false)
  })
})
