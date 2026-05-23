/**
 * Emoji → Google Noto Animated Emoji (Lottie JSON) CDN URL 转换工具
 *
 * URL 格式: https://fonts.gstatic.com/s/e/notoemoji/latest/{codepoints}/lottie.json
 * codepoints 为小写十六进制，多码点用下划线连接
 */

import type { DesktopEffect } from './effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from './effect'

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
export function splitEmojisEffect(text: string): DesktopEffect<string[]> {
  return fromSync(() => {
    const IntlAny = Intl as any
    if (IntlAny.Segmenter) {
      const segmenter = new IntlAny.Segmenter('en', { granularity: 'grapheme' })
      return Array.from(segmenter.segment(text.trim()), (s: { segment: string }) => s.segment)
    }
    return [text.trim()]
  })
}

export function splitEmojis(text: string): string[] {
  return runDesktopSync(splitEmojisEffect(text))
}

/** Lottie JSON 缓存，避免重复请求 */
const lottieCache = new Map<string, any>()
const pendingFetches = new Map<string, Promise<any>>()

function fetchEmojiLottieRequestEffect(url: string): DesktopEffect<any | null> {
  return Effect.gen(function* () {
    const res = yield* fromPromise(() => fetch(url))
    if (!res.ok) return null
    const data = yield* fromPromise(() => res.json())
    if (data) yield* fromSync(() => lottieCache.set(url, data))
    return data
  }).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
    Effect.ensuring(Effect.sync(() => pendingFetches.delete(url))),
  )
}

export function fetchEmojiLottieEffect(emoji: string): DesktopEffect<any | null> {
  const url = getEmojiLottieUrl(emoji)

  if (lottieCache.has(url)) return Effect.succeed(lottieCache.get(url))
  const pending = pendingFetches.get(url)
  if (pending) return fromPromise(() => pending)

  const promise = runDesktopEffect(fetchEmojiLottieRequestEffect(url))

  pendingFetches.set(url, promise)
  return fromPromise(() => promise)
}

export function fetchEmojiLottie(emoji: string): Promise<any | null> {
  return runDesktopEffect(fetchEmojiLottieEffect(emoji))
}
