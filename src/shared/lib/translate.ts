import { fetch as tauriFetch } from '@tauri-apps/plugin-http'

const cache = new Map<string, string>()

export async function translateText(text: string, targetLang: string): Promise<string> {
  const cacheKey = `${text}_${targetLang}`
  if (cache.has(cacheKey))
    return cache.get(cacheKey)!

  const url = new URL('https://translate.googleapis.com/translate_a/single')
  url.searchParams.set('client', 'gtx')
  url.searchParams.set('sl', 'auto')
  url.searchParams.set('tl', targetLang)
  url.searchParams.set('dt', 't')
  url.searchParams.set('q', text)

  const res = await tauriFetch(url.toString())
  if (!res.ok)
    throw new Error(`Translation failed: ${res.status}`)

  const data = await res.json()
  const translated = (data[0] as any[])
    .filter((seg: any) => seg?.[0])
    .map((seg: any) => seg[0])
    .join('')

  cache.set(cacheKey, translated)
  return translated
}

export function getSystemLanguage(): string {
  const lang = navigator.language?.toLowerCase() ?? ''
  if (lang.startsWith('zh'))
    return 'zh'
  return 'en'
}
