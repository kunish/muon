// Re-exported from shared — settings are application-wide preferences,
// not a feature-internal concern.  New code should import from
// @shared/stores/settingsStore directly.
export {
  type MessageAlignment,
  type MessageFontScale,
  type NotificationChannelId,
  type NotificationChannels,
  type SendMessageShortcut,
  type ThemeMode,
  useSettingsStore,
} from '@/shared/stores/settingsStore'
