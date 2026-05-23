import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'

export const MAX_LINK_PREVIEW_BYTES = 2 * 1024 * 1024

const BLOCKED_HOSTS = new Set(['localhost', 'metadata.google.internal'])

const TRAILING_DOT_RE = /\.$/
const DECIMAL_RE = /^\d+$/
const IPV6_WORD_RE = /^[\da-f]{1,4}$/i
const LINK_LOCAL_IPV6_RE = /^fe[89ab]/

function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase().replace(TRAILING_DOT_RE, '')
  if (lower.startsWith('[') && lower.endsWith(']')) return lower.slice(1, -1)
  return lower
}

function parseIpv4(hostname: string): number[] | null {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null

  const octets = parts.map((part) => {
    if (!DECIMAL_RE.test(part)) return Number.NaN
    return Number(part)
  })

  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null

  return octets
}

function isBlockedIpv4(hostname: string): boolean {
  const octets = parseIpv4(hostname)
  if (!octets) return false

  const [first, second] = octets
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

function isBlockedIpv4MappedIpv6(hostname: string): boolean {
  if (!hostname.startsWith('::ffff:')) return false

  const mapped = hostname.slice('::ffff:'.length)
  if (mapped.includes('.')) return isBlockedIpv4(mapped)

  const parts = mapped.split(':')
  if (parts.length !== 2) return false

  const words = parts.map((part) => {
    if (!IPV6_WORD_RE.test(part)) return Number.NaN
    return Number.parseInt(part, 16)
  })
  if (words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)) return false

  const [high, low] = words
  return isBlockedIpv4([high >> 8, high & 0xff, low >> 8, low & 0xff].join('.'))
}

function isBlockedIpv6(hostname: string): boolean {
  const host = hostname.toLowerCase()
  if (host === '::' || host === '::1') return true
  if (host.startsWith('fc') || host.startsWith('fd')) return true
  if (LINK_LOCAL_IPV6_RE.test(host)) return true
  if (isBlockedIpv4MappedIpv6(host)) return true
  return false
}

function isUnsafeHostname(hostname: string): boolean {
  const host = normalizeHostname(hostname)
  return (
    BLOCKED_HOSTS.has(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    isBlockedIpv4(host) ||
    isBlockedIpv6(host)
  )
}

export function getPreviewRequestUrl(rawUrl: string): URL | null {
  return runDesktopSync(getPreviewRequestUrlEffect(rawUrl))
}

export function getPreviewRequestUrlEffect(rawUrl: string): DesktopEffect<URL | null> {
  return fromSync(() => {
    const url = new URL(rawUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (isUnsafeHostname(url.hostname)) return null

    url.username = ''
    url.password = ''
    return url
  }).pipe(Effect.catchAll(() => Effect.succeed(null)))
}

export function getPreviewAssetUrl(rawUrl: string | null | undefined, baseUrl: string): string {
  return runDesktopSync(getPreviewAssetUrlEffect(rawUrl, baseUrl))
}

export function getPreviewAssetUrlEffect(rawUrl: string | null | undefined, baseUrl: string): DesktopEffect<string> {
  if (!rawUrl) return Effect.succeed('')

  return fromSync(() => {
    const resolved = new URL(rawUrl, baseUrl)
    return getPreviewRequestUrl(resolved.href)?.href ?? ''
  }).pipe(Effect.catchAll(() => Effect.succeed('')))
}

export function isHtmlPreviewResponse(resp: Response, maxBytes = MAX_LINK_PREVIEW_BYTES): boolean {
  if (!resp.ok) return false

  const contentType = resp.headers.get('content-type')?.toLowerCase() ?? ''
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) return false

  const contentLength = resp.headers.get('content-length')
  if (contentLength !== null) {
    const bytes = Number(contentLength)
    if (!Number.isFinite(bytes) || bytes > maxBytes) return false
  }

  return true
}

export function readLimitedText(resp: Response, maxBytes = MAX_LINK_PREVIEW_BYTES): Promise<string | null> {
  return runDesktopEffect(readLimitedTextEffect(resp, maxBytes))
}

export function readLimitedTextEffect(resp: Response, maxBytes = MAX_LINK_PREVIEW_BYTES): DesktopEffect<string | null> {
  if (!resp.body) return Effect.succeed(null)

  return fromSync(() => resp.body!.getReader()).pipe(
    Effect.flatMap((reader) => {
      const decoder = new TextDecoder()
      let bytesRead = 0
      let text = ''

      return Effect.gen(function* () {
        while (true) {
          const { done, value } = yield* fromPromise(() => reader.read())
          if (done) break

          bytesRead += value.byteLength
          if (bytesRead > maxBytes) {
            yield* fromPromise(() => reader.cancel())
            return null
          }

          text += decoder.decode(value, { stream: true })
        }

        text += decoder.decode()
        return text
      }).pipe(Effect.ensuring(Effect.sync(() => reader.releaseLock())))
    }),
  )
}
