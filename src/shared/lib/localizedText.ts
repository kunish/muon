import en from '@/locales/en.json'
import zh from '@/locales/zh.json'

type SupportedLocale = 'en' | 'zh'

const messages: Record<SupportedLocale, Record<string, unknown>> = { en, zh }

function normalizeLocale(value: unknown): SupportedLocale {
  return value === 'en' || value === 'zh' ? value : 'zh'
}

function readPersistedLocale(): SupportedLocale {
  try {
    const raw = globalThis.localStorage?.getItem('muon_locale')
    return normalizeLocale(raw ? JSON.parse(raw) : undefined)
  }
  catch {
    return 'zh'
  }
}

function lookupMessage(locale: SupportedLocale, key: string): string | null {
  let cursor: unknown = messages[locale]

  for (const part of key.split('.')) {
    if (!cursor || typeof cursor !== 'object')
      return null
    cursor = (cursor as Record<string, unknown>)[part]
  }

  return typeof cursor === 'string' ? cursor : null
}

export function localizedText(key: string): string {
  const locale = readPersistedLocale()
  return lookupMessage(locale, key) ?? lookupMessage('en', key) ?? key
}
