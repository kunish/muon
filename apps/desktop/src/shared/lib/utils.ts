import type { ClassValue } from 'clsx'
import type { DesktopEffect } from './effect'
import { clsx } from 'clsx'
import { Effect } from 'effect'
import { twMerge } from 'tailwind-merge'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from './effect'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g
const RE_QUOT = /"/g
const RE_APOS = /'/g

/**
 * Escape HTML special characters in a string.
 * Safe for embedding user-provided text in HTML.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(RE_AMP, '&amp;')
    .replace(RE_LT, '&lt;')
    .replace(RE_GT, '&gt;')
    .replace(RE_QUOT, '&quot;')
    .replace(RE_APOS, '&#39;')
}

/**
 * Compute SHA-256 hash of a file/blob for deduplication.
 * Uses Web Crypto API (SubtleCrypto).
 */
export function computeSha256(file: File | Blob): Promise<string> {
  return runDesktopEffect(computeSha256Effect(file))
}

export function computeSha256Effect(file: File | Blob): DesktopEffect<string> {
  return Effect.gen(function* () {
    const buffer = yield* fromPromise(() => file.arrayBuffer())
    const hashBuffer = yield* fromPromise(() => crypto.subtle.digest('SHA-256', buffer))
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  })
}

/**
 * Safe JSON serializer that handles circular references, functions,
 * symbols, and BigInts that would cause JSON.stringify to throw.
 */
export function safeJsonStringify(value: unknown, space?: number): string {
  return runDesktopSync(safeJsonStringifyEffect(value, space))
}

export function safeJsonStringifyEffect(value: unknown, space?: number): DesktopEffect<string> {
  const seen = new WeakSet<object>()

  function replacer(_key: string, val: unknown): unknown {
    if (val === null || val === undefined) return null
    if (typeof val === 'function') return '[Function]'
    if (typeof val === 'symbol') return `[Symbol: ${String(val.description || '')}]`
    if (typeof val === 'bigint') return `[BigInt: ${val.toString()}]`
    if (typeof val === 'object') {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }
    return val
  }

  return fromSync(() => {
    return JSON.stringify(value, replacer, space)
  }).pipe(Effect.catchAll(() => Effect.succeed(`"[SerializationError]"`)))
}
