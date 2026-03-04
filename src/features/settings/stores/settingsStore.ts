import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'system'
export type MessageAlignment = 'left' | 'leftright'

export const useSettingsStore = defineStore('settings', () => {
  const theme = useStorage<ThemeMode>('muon_theme', 'system')
  const locale = useStorage<string>('muon_locale', 'zh')
  const notificationsEnabled = useStorage('muon_notifications', true)
  const notificationPreview = useStorage('muon_notification_preview', true)
  const dndStart = useStorage('muon_dnd_start', '')
  const dndEnd = useStorage('muon_dnd_end', '')
  const messageAlignment = useStorage<MessageAlignment>('muon_message_alignment', 'leftright')
  const closeToTray = useStorage('muon_close_to_tray', true)
  const autoLaunch = useStorage('muon_auto_launch', false)
  const analyticsEnabled = useStorage('muon_analytics_enabled', true)
  const watermarkEnabled = useStorage('muon_watermark_enabled', false)

  return {
    theme,
    locale,
    notificationsEnabled,
    notificationPreview,
    dndStart,
    dndEnd,
    messageAlignment,
    closeToTray,
    autoLaunch,
    analyticsEnabled,
    watermarkEnabled,
  }
})
