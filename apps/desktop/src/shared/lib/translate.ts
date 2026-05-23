import type { DesktopEffect } from './effect'
import { Effect } from 'effect'
import { fetch as desktopFetch } from '@/desktop/http'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from './effect'

const cache = new Map<string, string>()

export function translateTextEffect(text: string, targetLang: string): DesktopEffect<string> {
  return Effect.gen(function* () {
    const cacheKey = `${text}_${targetLang}`
    if (cache.has(cacheKey)) return cache.get(cacheKey)!

    const url = new URL('https://translate.googleapis.com/translate_a/single')
    url.searchParams.set('client', 'gtx')
    url.searchParams.set('sl', 'auto')
    url.searchParams.set('tl', targetLang)
    url.searchParams.set('dt', 't')
    url.searchParams.set('q', text)

    const res = yield* fromPromise(() => desktopFetch(url.toString()))
    if (!res.ok) {
      return yield* fromSync(() => {
        throw new Error(`Translation failed: ${res.status}`)
      })
    }

    const data = yield* fromPromise(() => res.json())
    const translated = (data[0] as any[])
      .filter((seg: any) => seg?.[0])
      .map((seg: any) => seg[0])
      .join('')

    cache.set(cacheKey, translated)
    return translated
  })
}

export function translateText(text: string, targetLang: string): Promise<string> {
  return runDesktopEffect(translateTextEffect(text, targetLang))
}

export function getSystemLanguageEffect(): DesktopEffect<string> {
  return fromSync(() => {
    const lang = navigator.language?.toLowerCase() ?? ''
    if (lang.startsWith('zh')) return 'zh'
    return 'en'
  })
}

export function getSystemLanguage(): string {
  return runDesktopSync(getSystemLanguageEffect())
}
