/**
 * Emoji → Google Noto Animated Emoji (Lottie JSON) CDN URL 转换工具
 *
 * URL 格式: https://fonts.gstatic.com/s/e/notoemoji/latest/{codepoints}/lottie.json
 * codepoints 为小写十六进制，多码点用下划线连接
 */

const CDN_BASE = 'https://fonts.gstatic.com/s/e/notoemoji/latest'

/** 将单个 emoji 字符转为 codepoint 路径段，如 ❤️ → "2764_fe0f" */
function emojiToCodepoints(emoji: string): string {
  const codepoints: string[] = []
  for (const char of emoji) {
    const cp = char.codePointAt(0)
    if (cp !== undefined) {
      // 跳过 VS16 (U+FE0F) 以外的变体选择符，但保留 FE0F
      codepoints.push(cp.toString(16))
    }
  }
  return codepoints.join('_')
}

/** 获取 emoji 的 Lottie JSON CDN URL */
function getEmojiLottieUrl(emoji: string): string {
  return `${CDN_BASE}/${emojiToCodepoints(emoji)}/lottie.json`
}

/** 拆分 emoji 字符串为单个 emoji 数组 */
export function splitEmojis(text: string): string[] {
  const IntlAny = Intl as any
  if (IntlAny.Segmenter) {
    const segmenter = new IntlAny.Segmenter('en', { granularity: 'grapheme' })
    return Array.from(segmenter.segment(text.trim()), (s: { segment: string }) => s.segment)
  }
  return [text.trim()]
}

/** Lottie JSON 缓存，避免重复请求 */
const lottieCache = new Map<string, any>()
const pendingFetches = new Map<string, Promise<any>>()

/** 获取 emoji 的 Lottie JSON 数据，带缓存和去重 */
export async function fetchEmojiLottie(emoji: string): Promise<any | null> {
  const url = getEmojiLottieUrl(emoji)

  if (lottieCache.has(url))
    return lottieCache.get(url)
  if (pendingFetches.has(url))
    return pendingFetches.get(url)

  const promise = fetch(url)
    .then((res) => {
      if (!res.ok)
        return null
      return res.json()
    })
    .then((data) => {
      if (data)
        lottieCache.set(url, data)
      pendingFetches.delete(url)
      return data
    })
    .catch(() => {
      pendingFetches.delete(url)
      return null
    })

  pendingFetches.set(url, promise)
  return promise
}
