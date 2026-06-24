import { Store } from '@tanstack/vue-store'

export type ThemeMode = 'light' | 'dark' | 'system'
export type MessageAlignment = 'left' | 'leftright'
export type SendMessageShortcut = 'enter' | 'mod-enter'
export type MessageFontScale = 'small' | 'standard' | 'large' | 'xlarge'
export type NotificationChannelId = 'approvals' | 'calendar' | 'mentions' | 'messages'
export type NotificationChannels = Record<NotificationChannelId, boolean>

/** Multiplier applied to chat message text for each font-size preset. */
export const MESSAGE_FONT_SCALE_VALUES: Record<MessageFontScale, number> = {
  small: 0.875,
  standard: 1,
  large: 1.15,
  xlarge: 1.3,
}

const DEFAULT_NOTIFICATION_CHANNELS: NotificationChannels = {
  approvals: true,
  calendar: true,
  mentions: true,
  messages: true,
}

// 鸭栏默认固定集：飞书核心 + 有真实本地数据的 calendar/tasks。其余收进「全部应用」面板。
const DEFAULT_PINNED_APPS: string[] = ['messages', 'calendar', 'docs', 'tasks', 'contacts', 'workplace']

export interface SettingsState {
  theme: ThemeMode
  locale: string
  notificationsEnabled: boolean
  notificationPreview: boolean
  notificationSound: boolean
  badgeCount: boolean
  notificationChannels: NotificationChannels
  dndStart: string
  dndEnd: string
  messageAlignment: MessageAlignment
  messageFontScale: MessageFontScale
  sendMessageShortcut: SendMessageShortcut
  closeToTray: boolean
  autoLaunch: boolean
  analyticsEnabled: boolean
  watermarkEnabled: boolean
  debugMode: boolean
  pinnedApps: string[]
}

const STORAGE_KEYS = {
  theme: 'muon_theme',
  locale: 'muon_locale',
  notificationsEnabled: 'muon_notifications',
  notificationPreview: 'muon_notification_preview',
  notificationSound: 'muon_notification_sound',
  badgeCount: 'muon_badge_count',
  notificationChannels: 'muon_notification_channels',
  dndStart: 'muon_dnd_start',
  dndEnd: 'muon_dnd_end',
  messageAlignment: 'muon_message_alignment',
  messageFontScale: 'muon_message_font_scale',
  sendMessageShortcut: 'muon_send_message_shortcut',
  closeToTray: 'muon_close_to_tray',
  autoLaunch: 'muon_auto_launch',
  analyticsEnabled: 'muon_analytics_enabled',
  watermarkEnabled: 'muon_watermark_enabled',
  debugMode: 'muon_debug_mode',
  pinnedApps: 'muon_pinned_apps',
} as const

function readString<T extends string>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : (raw as T)
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : raw === 'true'
}

function readStringArray(key: string, fallback: string[]): string[] {
  const raw = localStorage.getItem(key)
  if (raw === null) return [...fallback]
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') ? parsed : [...fallback]
  } catch {
    return [...fallback]
  }
}

function readChannels(): NotificationChannels {
  const raw = localStorage.getItem(STORAGE_KEYS.notificationChannels)
  if (raw === null) return { ...DEFAULT_NOTIFICATION_CHANNELS }
  try {
    return { ...DEFAULT_NOTIFICATION_CHANNELS, ...(JSON.parse(raw) as Partial<NotificationChannels>) }
  } catch {
    return { ...DEFAULT_NOTIFICATION_CHANNELS }
  }
}

function createInitialState(): SettingsState {
  return {
    theme: readString<ThemeMode>(STORAGE_KEYS.theme, 'system'),
    locale: readString(STORAGE_KEYS.locale, 'zh'),
    notificationsEnabled: readBoolean(STORAGE_KEYS.notificationsEnabled, true),
    notificationPreview: readBoolean(STORAGE_KEYS.notificationPreview, true),
    notificationSound: readBoolean(STORAGE_KEYS.notificationSound, true),
    badgeCount: readBoolean(STORAGE_KEYS.badgeCount, true),
    notificationChannels: readChannels(),
    dndStart: readString(STORAGE_KEYS.dndStart, ''),
    dndEnd: readString(STORAGE_KEYS.dndEnd, ''),
    messageAlignment: readString<MessageAlignment>(STORAGE_KEYS.messageAlignment, 'leftright'),
    messageFontScale: readString<MessageFontScale>(STORAGE_KEYS.messageFontScale, 'standard'),
    sendMessageShortcut: readString<SendMessageShortcut>(STORAGE_KEYS.sendMessageShortcut, 'enter'),
    closeToTray: readBoolean(STORAGE_KEYS.closeToTray, true),
    autoLaunch: readBoolean(STORAGE_KEYS.autoLaunch, false),
    analyticsEnabled: readBoolean(STORAGE_KEYS.analyticsEnabled, true),
    watermarkEnabled: readBoolean(STORAGE_KEYS.watermarkEnabled, false),
    debugMode: readBoolean(STORAGE_KEYS.debugMode, false),
    pinnedApps: readStringArray(STORAGE_KEYS.pinnedApps, DEFAULT_PINNED_APPS),
  }
}

function persist(state: SettingsState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.theme, state.theme)
    localStorage.setItem(STORAGE_KEYS.locale, state.locale)
    localStorage.setItem(STORAGE_KEYS.notificationsEnabled, String(state.notificationsEnabled))
    localStorage.setItem(STORAGE_KEYS.notificationPreview, String(state.notificationPreview))
    localStorage.setItem(STORAGE_KEYS.notificationSound, String(state.notificationSound))
    localStorage.setItem(STORAGE_KEYS.badgeCount, String(state.badgeCount))
    localStorage.setItem(STORAGE_KEYS.notificationChannels, JSON.stringify(state.notificationChannels))
    localStorage.setItem(STORAGE_KEYS.dndStart, state.dndStart)
    localStorage.setItem(STORAGE_KEYS.dndEnd, state.dndEnd)
    localStorage.setItem(STORAGE_KEYS.messageAlignment, state.messageAlignment)
    localStorage.setItem(STORAGE_KEYS.messageFontScale, state.messageFontScale)
    localStorage.setItem(STORAGE_KEYS.sendMessageShortcut, state.sendMessageShortcut)
    localStorage.setItem(STORAGE_KEYS.closeToTray, String(state.closeToTray))
    localStorage.setItem(STORAGE_KEYS.autoLaunch, String(state.autoLaunch))
    localStorage.setItem(STORAGE_KEYS.analyticsEnabled, String(state.analyticsEnabled))
    localStorage.setItem(STORAGE_KEYS.watermarkEnabled, String(state.watermarkEnabled))
    localStorage.setItem(STORAGE_KEYS.debugMode, String(state.debugMode))
    localStorage.setItem(STORAGE_KEYS.pinnedApps, JSON.stringify(state.pinnedApps))
  } catch (err) {
    console.warn('[settingsStore] Failed to persist settings:', err)
  }
}

export const settingsStore = new Store<SettingsState>(createInitialState())

settingsStore.subscribe(() => {
  persist(settingsStore.state)
})

export function setTheme(theme: ThemeMode): void {
  settingsStore.setState((s) => ({ ...s, theme }))
}
export function setLocale(locale: string): void {
  settingsStore.setState((s) => ({ ...s, locale }))
}
export function setNotificationsEnabled(notificationsEnabled: boolean): void {
  settingsStore.setState((s) => ({ ...s, notificationsEnabled }))
}
export function setNotificationPreview(notificationPreview: boolean): void {
  settingsStore.setState((s) => ({ ...s, notificationPreview }))
}
export function setNotificationSound(notificationSound: boolean): void {
  settingsStore.setState((s) => ({ ...s, notificationSound }))
}
export function setBadgeCount(badgeCount: boolean): void {
  settingsStore.setState((s) => ({ ...s, badgeCount }))
}
export function setDndStart(dndStart: string): void {
  settingsStore.setState((s) => ({ ...s, dndStart }))
}
export function setDndEnd(dndEnd: string): void {
  settingsStore.setState((s) => ({ ...s, dndEnd }))
}
export function setMessageAlignment(messageAlignment: MessageAlignment): void {
  settingsStore.setState((s) => ({ ...s, messageAlignment }))
}
export function setMessageFontScale(messageFontScale: MessageFontScale): void {
  settingsStore.setState((s) => ({ ...s, messageFontScale }))
}
export function setSendMessageShortcut(sendMessageShortcut: SendMessageShortcut): void {
  settingsStore.setState((s) => ({ ...s, sendMessageShortcut }))
}
export function setCloseToTray(closeToTray: boolean): void {
  settingsStore.setState((s) => ({ ...s, closeToTray }))
}
export function setAutoLaunch(autoLaunch: boolean): void {
  settingsStore.setState((s) => ({ ...s, autoLaunch }))
}
export function setAnalyticsEnabled(analyticsEnabled: boolean): void {
  settingsStore.setState((s) => ({ ...s, analyticsEnabled }))
}
export function setWatermarkEnabled(watermarkEnabled: boolean): void {
  settingsStore.setState((s) => ({ ...s, watermarkEnabled }))
}
export function setDebugMode(debugMode: boolean): void {
  settingsStore.setState((s) => ({ ...s, debugMode }))
}

export function togglePinnedApp(id: string): void {
  settingsStore.setState((s) => ({
    ...s,
    pinnedApps: s.pinnedApps.includes(id) ? s.pinnedApps.filter((x) => x !== id) : [...s.pinnedApps, id],
  }))
}

export function setNotificationChannel(channel: NotificationChannelId, enabled: boolean): void {
  settingsStore.setState((s) => ({
    ...s,
    notificationChannels: { ...DEFAULT_NOTIFICATION_CHANNELS, ...s.notificationChannels, [channel]: enabled },
  }))
}

export function selectNormalizedNotificationChannels(state: SettingsState): NotificationChannels {
  return { ...DEFAULT_NOTIFICATION_CHANNELS, ...state.notificationChannels }
}
export function selectActiveNotificationChannelCount(state: SettingsState): number {
  return Object.values(selectNormalizedNotificationChannels(state)).filter(Boolean).length
}
export function selectMessageFontScaleValue(state: SettingsState): number {
  return MESSAGE_FONT_SCALE_VALUES[state.messageFontScale] ?? 1
}

/** Reset to values hydrated from localStorage. Used by tests for isolation and by future logout cleanup. */
export function resetSettingsStore(): void {
  settingsStore.setState(() => createInitialState())
}
