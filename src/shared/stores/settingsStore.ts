import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'
import { computed } from 'vue'

export type ThemeMode = 'light' | 'dark' | 'system'
export type MessageAlignment = 'left' | 'leftright'
export type NotificationChannelId = 'approvals' | 'calendar' | 'mentions' | 'messages'
export type NotificationChannels = Record<NotificationChannelId, boolean>

const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannels = {
  approvals: true,
  calendar: true,
  mentions: true,
  messages: true,
}

/**
 * Application-wide user preferences store.
 *
 * Settings are inherently global configuration consumed by many features.
 * This store lives in shared/ to avoid every feature importing from the
 * settings feature for simple preference reads.
 */
export const useSettingsStore = defineStore('settings', () => {
  const theme = useStorage<ThemeMode>('muon_theme', 'system')
  const locale = useStorage<string>('muon_locale', 'zh')
  const notificationsEnabled = useStorage('muon_notifications', true)
  const notificationPreview = useStorage('muon_notification_preview', true)
  const notificationSound = useStorage('muon_notification_sound', true)
  const badgeCount = useStorage('muon_badge_count', true)
  const notificationChannels = useStorage<NotificationChannels>(
    'muon_notification_channels',
    DEFAULT_NOTIFICATION_CHANNELS,
  )
  const dndStart = useStorage('muon_dnd_start', '')
  const dndEnd = useStorage('muon_dnd_end', '')
  const messageAlignment = useStorage<MessageAlignment>('muon_message_alignment', 'leftright')
  const closeToTray = useStorage('muon_close_to_tray', true)
  const autoLaunch = useStorage('muon_auto_launch', false)
  const analyticsEnabled = useStorage('muon_analytics_enabled', true)
  const watermarkEnabled = useStorage('muon_watermark_enabled', false)

  const normalizedNotificationChannels = computed<NotificationChannels>(() => ({
    ...DEFAULT_NOTIFICATION_CHANNELS,
    ...notificationChannels.value,
  }))

  const activeNotificationChannelCount = computed(() =>
    Object.values(normalizedNotificationChannels.value).filter(Boolean).length,
  )

  function setNotificationChannel(channel: NotificationChannelId, enabled: boolean): void {
    notificationChannels.value = {
      ...normalizedNotificationChannels.value,
      [channel]: enabled,
    }
  }

  return {
    theme,
    locale,
    notificationsEnabled,
    notificationPreview,
    notificationSound,
    badgeCount,
    notificationChannels,
    activeNotificationChannelCount,
    dndStart,
    dndEnd,
    messageAlignment,
    closeToTray,
    autoLaunch,
    analyticsEnabled,
    watermarkEnabled,
    setNotificationChannel,
  }
})
