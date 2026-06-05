# TanStack P1 — settingsStore Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `settingsStore` from Pinia (`useStorage`-backed) to native `@tanstack/vue-store` with explicit, localStorage-compatible persistence, converting all 13 consumers + 3 integration watchers, with zero observable behavior change and **no loss of existing users' persisted settings**.

**Architecture:** A module-level `new Store<SettingsState>(...)` hydrated from the existing `muon_*` localStorage keys, with one `subscribe` that re-persists on change using `@vueuse`-compatible serialization (boolean→`'true'/'false'`, string→raw, object→JSON). One named setter action per writable field + `setNotificationChannel`, plus pure selector functions for the two computed values. Consumers read via `useSelector` (templates) / `settingsStore.state.X` (imperative) and call setters; `v-model="store.X"` becomes `:model-value` + `@update:model-value="setX"`. Bootstrap-scope watchers (desktopSettings, i18n) use `settingsStore.subscribe`; component-scope `useTheme` uses `useSelector` + `watch`.

**Tech Stack:** Vue 3, `@tanstack/vue-store@0.11` (`Store`, `useSelector`), Vitest.

**Spec:** `docs/superpowers/specs/2026-06-05-tanstack-suite-refactor-design.md` (P1). Reference pattern: `docs/superpowers/plans/2026-06-05-tanstack-p1-globalui-store.md`.

---

## Persistence compatibility (critical)

The Pinia store used `@vueuse/core` `useStorage`, which persists each field under its own key with type-specific serialization. The migrated store MUST read/write the **same keys with the same format** so existing settings survive the upgrade:

| Field | Key | Type | Stored as |
| --- | --- | --- | --- |
| theme | `muon_theme` | string | raw |
| locale | `muon_locale` | string | raw |
| notificationsEnabled | `muon_notifications` | boolean | `'true'`/`'false'` |
| notificationPreview | `muon_notification_preview` | boolean | `'true'`/`'false'` |
| notificationSound | `muon_notification_sound` | boolean | `'true'`/`'false'` |
| badgeCount | `muon_badge_count` | boolean | `'true'`/`'false'` |
| notificationChannels | `muon_notification_channels` | object | JSON |
| dndStart | `muon_dnd_start` | string | raw |
| dndEnd | `muon_dnd_end` | string | raw |
| messageAlignment | `muon_message_alignment` | string | raw |
| messageFontScale | `muon_message_font_scale` | string | raw |
| sendMessageShortcut | `muon_send_message_shortcut` | string | raw |
| closeToTray | `muon_close_to_tray` | boolean | `'true'`/`'false'` |
| autoLaunch | `muon_auto_launch` | boolean | `'true'`/`'false'` |
| analyticsEnabled | `muon_analytics_enabled` | boolean | `'true'`/`'false'` |
| watermarkEnabled | `muon_watermark_enabled` | boolean | `'true'`/`'false'` |
| debugMode | `muon_debug_mode` | boolean | `'true'`/`'false'` |

Do NOT change `apps/desktop/src/app/plugins/i18n.ts`'s `readPersistedLocale` (it `JSON.parse`s `muon_locale` directly — a pre-existing quirk that falls back to `'zh'`; preserve it as-is, out of scope).

---

## File Structure

- `apps/desktop/src/shared/stores/settingsStore.ts` — **rewrite**: native store + hydration + persistence + 16 setters + `setNotificationChannel` + 3 selectors + `resetSettingsStore`.
- `apps/desktop/src/features/settings/stores/settingsStore.ts` — **modify**: re-export the new API.
- `apps/desktop/tests/unit/stores/settingsStore.test.ts` — **rewrite**: new-API tests.
- `apps/desktop/src/app/plugins/desktopSettings.ts` — **rewrite**: `subscribe`-based watcher.
- `apps/desktop/src/app/plugins/i18n.ts` — **modify**: `subscribe`-based locale sync (leave `readPersistedLocale` untouched).
- `apps/desktop/src/features/settings/composables/useTheme.ts` — **rewrite**: `useSelector` + `watch`.
- `apps/desktop/src/features/settings/components/AppearanceSettings.vue` — **modify**: theme/locale/messageAlignment/messageFontScale/sendMessageShortcut reads + setters.
- `apps/desktop/src/features/settings/components/GeneralSettings.vue` — **modify**: autoLaunch/closeToTray/analyticsEnabled/debugMode v-model → setters.
- `apps/desktop/src/features/settings/components/NotificationSettings.vue` — **modify**: notification fields + `setNotificationChannel`.
- `apps/desktop/src/features/settings/components/SecuritySettings.vue` — **modify**: watermarkEnabled.
- `apps/desktop/src/app/components/AppLayout.vue` — **modify**: read badgeCount, watermarkEnabled.
- `apps/desktop/src/features/chat/composables/useNotificationSound.ts` — **modify**: read 6 fields via snapshot.
- `apps/desktop/src/features/chat/components/MessageList.vue` — **modify**: read messageFontScaleValue.
- `apps/desktop/src/features/chat/components/ChatMessage.vue` — **modify**: read messageAlignment, debugMode.
- `apps/desktop/src/features/chat/components/MessageGroup.vue` — **modify**: read messageAlignment.
- `apps/desktop/src/features/chat/components/RichTextInput.vue` — **modify**: read sendMessageShortcut.

The Pinia `useSettingsStore` export is removed; all consumers + the test convert in lockstep so type-check is green at the end of Task 4.

---

## Conversion rules (apply consistently)

Given the migrated store exports `settingsStore`, setters `setX`, selectors `selectX`, and `setNotificationChannel`:

- **Template reactive read** `store.X` (e.g. `{{ store.theme }}`, `:class="store.theme === ..."`, `:model-value="store.X"`) → declare `const X = useSelector(settingsStore, (s) => s.X)` in `<script setup>` and use `X` in template.
- **Two-way** `v-model="store.X"` → `:model-value="X" @update:model-value="setX"` (with `X` a `useSelector` ref and `setX` imported).
- **Assignment** `store.X = v` → `setX(v)`.
- **Imperative read in `.ts` / event handler / non-template computed** → `settingsStore.state.X` (snapshot).
- **Computed read** `store.messageFontScaleValue` → `useSelector(settingsStore, selectMessageFontScaleValue)`; `store.activeNotificationChannelCount` → `useSelector(settingsStore, selectActiveNotificationChannelCount)`.
- `store.setNotificationChannel(id, v)` → import and call `setNotificationChannel(id, v)`.
- Drop the `const store = useSettingsStore()` handle.

---

### Task 1: Rewrite the store module, re-export shim, and unit test

**Files:**
- Rewrite: `apps/desktop/src/shared/stores/settingsStore.ts`
- Modify: `apps/desktop/src/features/settings/stores/settingsStore.ts`
- Rewrite test: `apps/desktop/tests/unit/stores/settingsStore.test.ts`

- [ ] **Step 1: Rewrite the test to the new API (expect failure)**

Replace the ENTIRE contents of `apps/desktop/tests/unit/stores/settingsStore.test.ts` with:

```ts
import { beforeEach, describe, expect, it } from 'vitest'
import {
  resetSettingsStore,
  selectActiveNotificationChannelCount,
  selectMessageFontScaleValue,
  setMessageFontScale,
  setNotificationChannel,
  setNotificationsEnabled,
  setTheme,
  setLocale,
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
```

- [ ] **Step 2: Run the test — confirm it FAILS**

Run: `pnpm --filter @muon/desktop test:unit -- settingsStore.test.ts`
Expected: FAIL — the module has no `settingsStore`/`setTheme`/`resetSettingsStore`/etc. exports (still exports `useSettingsStore`).

- [ ] **Step 3: Rewrite the store module**

Replace the ENTIRE contents of `apps/desktop/src/shared/stores/settingsStore.ts` with:

```ts
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
} as const

function readString<T extends string>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : (raw as T)
}

function readBoolean(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key)
  return raw === null ? fallback : raw === 'true'
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
```

- [ ] **Step 4: Update the re-export shim**

Replace the ENTIRE contents of `apps/desktop/src/features/settings/stores/settingsStore.ts` with:

```ts
// Re-exported from shared — settings are application-wide preferences,
// not a feature-internal concern.  New code should import from
// @shared/stores/settingsStore directly.
export * from '@/shared/stores/settingsStore'
```

- [ ] **Step 5: Run the test — confirm it PASSES**

Run: `pnpm --filter @muon/desktop test:unit -- settingsStore.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/shared/stores/settingsStore.ts apps/desktop/src/features/settings/stores/settingsStore.ts apps/desktop/tests/unit/stores/settingsStore.test.ts
git commit -m "refactor(store): migrate settingsStore to vue-store"
```

Note: full type-check intentionally fails until Tasks 2–4 convert the consumers.

---

### Task 2: Convert the 3 integration watchers

**Files:**
- Rewrite: `apps/desktop/src/app/plugins/desktopSettings.ts`
- Modify: `apps/desktop/src/app/plugins/i18n.ts`
- Rewrite: `apps/desktop/src/features/settings/composables/useTheme.ts`

- [ ] **Step 1: Rewrite `desktopSettings.ts`** (bootstrap scope → `subscribe`)

Replace the ENTIRE contents of `apps/desktop/src/app/plugins/desktopSettings.ts` with:

```ts
import { settingsStore } from '@shared/stores/settingsStore'
import { setAutoLaunchEnabled, setCloseToTrayEnabled } from '@/desktop/app'

let stopDesktopSettingsSync: (() => void) | undefined

export function syncDesktopSettingsWithStore(): () => void {
  stopDesktopSettingsSync?.()

  let lastAutoLaunch = settingsStore.state.autoLaunch
  let lastCloseToTray = settingsStore.state.closeToTray

  // immediate sync
  void setAutoLaunchEnabled(lastAutoLaunch)
  void setCloseToTrayEnabled(lastCloseToTray)

  const subscription = settingsStore.subscribe(() => {
    const { autoLaunch, closeToTray } = settingsStore.state
    if (autoLaunch !== lastAutoLaunch) {
      lastAutoLaunch = autoLaunch
      void setAutoLaunchEnabled(autoLaunch)
    }
    if (closeToTray !== lastCloseToTray) {
      lastCloseToTray = closeToTray
      void setCloseToTrayEnabled(closeToTray)
    }
  })

  stopDesktopSettingsSync = () => {
    subscription.unsubscribe()
    stopDesktopSettingsSync = undefined
  }

  return stopDesktopSettingsSync
}
```

- [ ] **Step 2: Modify `i18n.ts`** (`syncI18nLocaleWithSettings` only)

In `apps/desktop/src/app/plugins/i18n.ts`:
- Change the import on line 1 `import type { WatchStopHandle } from 'vue'` — delete it (no longer used).
- Remove the now-unused `import { watch } from 'vue'` (line 4) IF `watch` is not used elsewhere in the file (it is not — verify with a search). Delete that import line.
- Change `import { useSettingsStore } from '@/features/settings/stores/settingsStore'` (line 6) to `import { settingsStore } from '@/features/settings/stores/settingsStore'`.
- Change the `stopLocaleSync` declaration (line 15) from `let stopLocaleSync: WatchStopHandle | undefined` to `let stopLocaleSync: (() => void) | undefined`.
- Replace the whole `syncI18nLocaleWithSettings` function (lines 45–55) with:

```ts
export function syncI18nLocaleWithSettings(): () => void {
  stopLocaleSync?.()

  setI18nLocale(settingsStore.state.locale)
  let lastLocale = settingsStore.state.locale

  const subscription = settingsStore.subscribe(() => {
    const locale = settingsStore.state.locale
    if (locale !== lastLocale) {
      lastLocale = locale
      setI18nLocale(locale)
    }
  })

  stopLocaleSync = () => {
    subscription.unsubscribe()
    stopLocaleSync = undefined
  }

  return stopLocaleSync
}
```

Leave `readPersistedLocale`, `readPersistedLocaleEffect`, `normalizeLocale`, `setI18nLocale`, and the `i18n` export UNCHANGED.

- [ ] **Step 3: Rewrite `useTheme.ts`** (component scope → `useSelector`)

Replace the ENTIRE contents of `apps/desktop/src/features/settings/composables/useTheme.ts` with:

```ts
import { useSelector } from '@tanstack/vue-store'
import { onScopeDispose, watch } from 'vue'
import { settingsStore } from '../stores/settingsStore'

export function useTheme() {
  const theme = useSelector(settingsStore, (s) => s.theme)
  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')

  function applyTheme() {
    const isDark = theme.value === 'dark' || (theme.value === 'system' && systemTheme.matches)
    document.documentElement.classList.toggle('dark', isDark)
  }

  function handleSystemThemeChange() {
    if (theme.value === 'system') applyTheme()
  }

  watch(theme, applyTheme, { immediate: true })

  systemTheme.addEventListener('change', handleSystemThemeChange)

  onScopeDispose(() => {
    systemTheme.removeEventListener('change', handleSystemThemeChange)
  })

  return { theme }
}
```

- [ ] **Step 4: Commit** (type-check still red until Tasks 3–4; do not run full type-check yet)

```bash
git add apps/desktop/src/app/plugins/desktopSettings.ts apps/desktop/src/app/plugins/i18n.ts apps/desktop/src/features/settings/composables/useTheme.ts
git commit -m "refactor(store): convert settings integration watchers to vue-store"
```

---

### Task 3: Convert the 4 settings-panel components

Apply the **Conversion rules** above. For each file, read it, locate every `useSettingsStore` usage, and convert. Import the needed `useSelector`, `settingsStore`, setters, selectors, and `setNotificationChannel` from `@/shared/stores/settingsStore` (or the feature shim — both work; prefer `@/shared/stores/settingsStore`). Remove the `const store = useSettingsStore()` handle.

**Files & exact field maps:**

- [ ] **Step 1: `AppearanceSettings.vue`**
  - Reads + writes (assignment style, `@click`/`@update:model-value` handlers):
    - `store.theme` (read at lines ~58/85; write `store.theme = opt.value` line ~59) → `theme = useSelector(...)`, `setTheme(opt.value)`.
    - `store.locale` (read line ~95; write `store.locale = v as string` line ~95) → `locale = useSelector(...)`, `setLocale(v as string)`.
    - `store.messageAlignment` (reads ~119/132/136; write line ~120) → `setMessageAlignment(opt.value)`.
    - `store.messageFontScale` (reads ~153/160; write line ~154) → `setMessageFontScale(opt.value)`.
    - `store.sendMessageShortcut` (reads ~179/185; write line ~180) → `setSendMessageShortcut(opt.value)`.
  - No `v-model` here (uses `@click`/`@update:model-value`); convert each reactive read to a `useSelector` ref and each assignment to the matching setter.

- [ ] **Step 2: `GeneralSettings.vue`**
  - `v-model="store.autoLaunch"` (line ~33) → `:model-value="autoLaunch" @update:model-value="setAutoLaunch"`.
  - `v-model="store.closeToTray"` (line ~41) → `setCloseToTray`.
  - `v-model="store.analyticsEnabled"` (line ~48) → `setAnalyticsEnabled`; also a `watch` exists on `store.analyticsEnabled` (line ~12) — convert that to `watch(useSelector(settingsStore, (s) => s.analyticsEnabled), ...)` (declare the selector ref once and reuse it for both the `v-model` and the watch).
  - `v-model="store.debugMode"` (line ~62) → `setDebugMode`.

- [ ] **Step 3: `NotificationSettings.vue`**
  - `store.notificationsEnabled` reads (lines ~72/131/146) → `notificationsEnabled = useSelector(...)`; write `store.notificationsEnabled = enabled` (line ~54) → `setNotificationsEnabled(enabled)`.
  - `v-model="store.notificationPreview"` (line ~82) → `setNotificationPreview`.
  - `v-model="store.notificationSound"` (line ~93) → `setNotificationSound`.
  - `v-model="store.badgeCount"` (line ~104) → `setBadgeCount`.
  - `store.activeNotificationChannelCount` (line ~121) → `useSelector(settingsStore, selectActiveNotificationChannelCount)`.
  - `store.notificationChannels[channel.id]` (line ~145) → use `useSelector(settingsStore, selectNormalizedNotificationChannels)` and index it.
  - `store.setNotificationChannel(channel.id, val)` (line ~147) → `setNotificationChannel(channel.id, val)`.
  - `v-model="store.dndStart"` (line ~159) → `setDndStart`.
  - `v-model="store.dndEnd"` (line ~164) → `setDndEnd`.

- [ ] **Step 4: `SecuritySettings.vue`**
  - `store.watermarkEnabled` read (lines ~17/38) → `watermarkEnabled = useSelector(...)`; write `store.watermarkEnabled = !store.watermarkEnabled` (line ~16) → `setWatermarkEnabled(!settingsStore.state.watermarkEnabled)`.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/features/settings/components/AppearanceSettings.vue apps/desktop/src/features/settings/components/GeneralSettings.vue apps/desktop/src/features/settings/components/NotificationSettings.vue apps/desktop/src/features/settings/components/SecuritySettings.vue
git commit -m "refactor(store): convert settings panel components to vue-store"
```

---

### Task 4: Convert the 6 read-only consumers and verify

Apply the **Conversion rules** (all reads, no writes here). Import `useSelector`, `settingsStore`, and selectors as needed.

- [ ] **Step 1: `AppLayout.vue`** — `store.badgeCount` (computed, line ~39) and `store.watermarkEnabled` (computed, line ~97). These are inside `computed(...)` in `<script setup>` → use `settingsStore.state.badgeCount` / `settingsStore.state.watermarkEnabled` **only if** the computed must stay reactive; since `computed` needs a reactive dep, declare `const badgeCount = useSelector(settingsStore, (s) => s.badgeCount)` and reference `badgeCount.value` inside the computed (same for watermarkEnabled).

- [ ] **Step 2: `useNotificationSound.ts`** — imperative reads inside functions (not reactive): `notificationPreview` (line ~46), `notificationsEnabled` (line ~70), `notificationChannels.messages` (line ~72), `dndStart`/`dndEnd` (line ~77), `notificationSound` (line ~97). Convert each to `settingsStore.state.X` snapshot reads (these run at event time, so snapshots are correct).

- [ ] **Step 3: `MessageList.vue`** — `settings.messageFontScaleValue` in a `:style` binding (line ~689) → `const messageFontScaleValue = useSelector(settingsStore, selectMessageFontScaleValue)` and bind `messageFontScaleValue`.

- [ ] **Step 4: `ChatMessage.vue`** — `settingsStore.messageAlignment` in computed `isRightAligned` (line ~138) → `useSelector` ref referenced in the computed; `settingsStore.debugMode` in template prop (line ~921) → `useSelector` ref `debugMode`.

- [ ] **Step 5: `MessageGroup.vue`** — `settingsStore.messageAlignment` inside `isRightAlignedGroup()` (line ~55). If this is a plain function called during render, use a `useSelector` ref `messageAlignment` and read `messageAlignment.value`; if it is a non-reactive helper, `settingsStore.state.messageAlignment` is fine. Prefer the `useSelector` ref to preserve reactivity in template-driven rendering.

- [ ] **Step 6: `RichTextInput.vue`** — `computed(() => settingsStore.sendMessageShortcut)` (line ~309) → `const sendMessageShortcut = useSelector(settingsStore, (s) => s.sendMessageShortcut)` and pass it (or `computed(() => sendMessageShortcut.value)`).

- [ ] **Step 7: Type-check**

Run: `pnpm --filter @muon/desktop type-check`
Expected: PASS.

- [ ] **Step 8: Confirm no stale references**

Run: `grep -rn "useSettingsStore" apps/desktop/src apps/desktop/tests`
Expected: NO output.

- [ ] **Step 9: Full unit suite + build + lint**

Run: `pnpm --filter @muon/desktop test:unit` → expected PASS (count: 1264 − 6 old settings tests + 8 new = 1266).
Run: `pnpm --filter @muon/desktop build:web` → expected success.
Run: `pnpm lint` → expected PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/desktop/src/app/components/AppLayout.vue apps/desktop/src/features/chat/composables/useNotificationSound.ts apps/desktop/src/features/chat/components/MessageList.vue apps/desktop/src/features/chat/components/ChatMessage.vue apps/desktop/src/features/chat/components/MessageGroup.vue apps/desktop/src/features/chat/components/RichTextInput.vue
git commit -m "refactor(store): convert remaining settingsStore consumers to vue-store"
```

---

## Self-Review

- **Spec coverage:** Migrates `settingsStore` to native `@tanstack/vue-store` with localStorage-compatible persistence (no setting loss), 16 setters + `setNotificationChannel`, 3 pure selectors, and `resetSettingsStore`. All 13 consumers + 3 integration watchers + the re-export shim convert; bootstrap watchers use `subscribe`, component `useTheme` uses `useSelector`. Follows the globalUiStore reference pattern.
- **No placeholders:** the store module, all 3 integration files, and the test are given as complete code. The 10 component/consumer conversions are specified as exact field→setter/selector maps + the consistent conversion rules; each is a deterministic transformation an implementer applies by reading the file. Line numbers are approximate guides (prefixed `~`); the field identities are exact.
- **Type consistency:** setter names (`setTheme`, `setLocale`, `setNotificationsEnabled`, `setNotificationPreview`, `setNotificationSound`, `setBadgeCount`, `setDndStart`, `setDndEnd`, `setMessageAlignment`, `setMessageFontScale`, `setSendMessageShortcut`, `setCloseToTray`, `setAutoLaunch`, `setAnalyticsEnabled`, `setWatermarkEnabled`, `setDebugMode`, `setNotificationChannel`), selectors (`selectNormalizedNotificationChannels`, `selectActiveNotificationChannelCount`, `selectMessageFontScaleValue`), `settingsStore`, and `resetSettingsStore` are defined in Task 1 Step 3 and used identically by the test (Step 1) and the consumer tasks. `Subscription.unsubscribe()` matches `@tanstack/store`'s type.
- **Behavior preservation:** same storage keys + serialization; `setNotificationChannel` preserves other channels via DEFAULT spread; the two computed values become pure selectors with identical formulas; integration watchers fire immediately + on change with the same effects; `i18n.readPersistedLocale` left untouched.
