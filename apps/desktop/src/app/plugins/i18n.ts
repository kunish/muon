import type { WatchStopHandle } from 'vue'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { useSettingsStore } from '@/features/settings/stores/settingsStore'
import en from '@/locales/en.json'
import zh from '@/locales/zh.json'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'

type SupportedLocale = 'en' | 'zh'

const SUPPORTED_LOCALES = new Set<SupportedLocale>(['en', 'zh'])

let stopLocaleSync: WatchStopHandle | undefined

function normalizeLocale(value: unknown): SupportedLocale {
  return typeof value === 'string' && SUPPORTED_LOCALES.has(value as SupportedLocale)
    ? (value as SupportedLocale)
    : 'zh'
}

function readPersistedLocale(): SupportedLocale {
  return runDesktopSync(readPersistedLocaleEffect())
}

function readPersistedLocaleEffect(): DesktopEffect<SupportedLocale> {
  return fromSync(() => {
    const raw = globalThis.localStorage?.getItem('muon_locale')
    return normalizeLocale(raw ? JSON.parse(raw) : undefined)
  }).pipe(Effect.catchAll(() => Effect.succeed('zh' as const)))
}

export const i18n = createI18n({
  legacy: false,
  locale: readPersistedLocale(),
  fallbackLocale: 'en',
  messages: { zh, en },
})

function setI18nLocale(locale: unknown): void {
  i18n.global.locale.value = normalizeLocale(locale)
}

export function syncI18nLocaleWithSettings(): WatchStopHandle {
  stopLocaleSync?.()

  const settingsStore = useSettingsStore()
  stopLocaleSync = watch(() => settingsStore.locale, setI18nLocale, { immediate: true })

  return () => {
    stopLocaleSync?.()
    stopLocaleSync = undefined
  }
}
