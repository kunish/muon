import type { DesktopEffect } from '@/shared/lib/effect'
import { encode } from 'blurhash'
import { Effect } from 'effect'
import { fetch as desktopFetch } from '@/desktop/http'
import { cacheMedia, getCachedMedia } from '@/features/chat/lib/mediaCache'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { getClient } from './client'

const BLURHASH_COMPONENT_X = 4
const BLURHASH_COMPONENT_Y = 3
const BLURHASH_SAMPLE_MAX_SIZE = 32
const MAX_INSTANT_MEDIA_URLS = 200
const instantMediaBlobUrls = new Map<string, string>()

function fetchMediaResponseEffect(url: string, headers: Record<string, string>): DesktopEffect<Response> {
  return fromPromise(() => desktopFetch(url, { headers }) as Promise<Response>).pipe(
    Effect.catchAll(() => fromPromise(() => fetch(url, { headers }))),
  )
}

function configuredMediaUploadUrl(): string | null {
  const url = import.meta.env.VITE_MUON_MEDIA_UPLOAD_URL?.trim()
  return url || null
}

function mediaFileName(file: File | Blob): string {
  return file instanceof File ? file.name : 'upload'
}

function instantMediaKey(url: string, width?: number, height?: number): string {
  return width && height ? `${url}__${width}x${height}` : url
}

function rememberInstantMediaBlobUrl(url: string, blob: Blob, width?: number, height?: number): string | null {
  const existing = getInstantMediaBlobUrl(url, width, height)
  if (existing) return existing
  if (typeof URL.createObjectURL !== 'function') return null

  const blobUrl = URL.createObjectURL(blob)
  instantMediaBlobUrls.set(instantMediaKey(url, width, height), blobUrl)

  while (instantMediaBlobUrls.size > MAX_INSTANT_MEDIA_URLS) {
    const [oldestKey, oldestUrl] = instantMediaBlobUrls.entries().next().value as [string, string]
    instantMediaBlobUrls.delete(oldestKey)
    URL.revokeObjectURL?.(oldestUrl)
  }

  return blobUrl
}

export function getInstantMediaBlobUrl(url: string, width?: number, height?: number): string | null {
  const exact = instantMediaBlobUrls.get(instantMediaKey(url, width, height))
  if (exact) return exact

  if (width && height) return instantMediaBlobUrls.get(instantMediaKey(url)) ?? null

  return null
}

function blurhashSampleSize(width: number, height: number): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }

  const scale = Math.min(1, BLURHASH_SAMPLE_MAX_SIZE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function encodeBlurhashFromImage(
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
): string | undefined {
  const sample = blurhashSampleSize(sourceWidth, sourceHeight)
  if (sample.width === 0 || sample.height === 0) return undefined

  try {
    const canvas = document.createElement('canvas')
    canvas.width = sample.width
    canvas.height = sample.height
    const context = canvas.getContext('2d')
    if (!context) return undefined

    context.drawImage(source, 0, 0, sample.width, sample.height)
    const imageData = context.getImageData(0, 0, sample.width, sample.height)
    return encode(imageData.data, imageData.width, imageData.height, BLURHASH_COMPONENT_X, BLURHASH_COMPONENT_Y)
  } catch {
    return undefined
  }
}

async function uploadConfiguredMedia(file: File | Blob, uploadUrl: string): Promise<string | null> {
  const response = await fetch(uploadUrl, {
    body: file,
    headers: {
      'content-type': file.type || 'application/octet-stream',
      'x-muon-file-name': encodeURIComponent(mediaFileName(file)),
    },
    method: 'POST',
  }).catch(() => null)

  if (!response) return null
  if (response.status === 503) return null

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Media upload failed: ${response.status}${body ? ` ${body}` : ''}`)
  }

  const payload = (await response.json()) as { url?: unknown }
  if (typeof payload.url !== 'string' || !payload.url) {
    throw new Error('Media upload response did not include a URL')
  }
  return payload.url
}

export function uploadMediaEffect(file: File | Blob): DesktopEffect<string> {
  return Effect.gen(function* () {
    const uploadUrl = configuredMediaUploadUrl()
    if (uploadUrl) {
      const uploadedUrl = yield* fromPromise(() => uploadConfiguredMedia(file, uploadUrl))
      if (uploadedUrl) {
        rememberInstantMediaBlobUrl(uploadedUrl, file)
        yield* fromPromise(() => cacheMedia(uploadedUrl, file)).pipe(Effect.catchAll(() => Effect.void))
        return uploadedUrl
      }
    }

    const response = yield* fromPromise(() =>
      getClient().uploadContent(file, {
        type: file.type,
      }),
    )
    rememberInstantMediaBlobUrl(response.content_uri, file)
    return response.content_uri
  })
}

export function uploadMedia(file: File | Blob): Promise<string> {
  return runDesktopEffect(uploadMediaEffect(file))
}

function isHttpMediaUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

function _mxcToHttp(mxcUrl: string): string {
  const client = getClient()
  return client.mxcUrlToHttp(mxcUrl) || ''
}

function _getThumbnailUrl(mxcUrl: string, width: number, height: number): string {
  const client = getClient()
  return client.mxcUrlToHttp(mxcUrl, width, height, 'crop') || ''
}

/**
 * Fetch media through the desktop HTTP bridge to bypass webview CORS/auth issues
 * and return a blob: URL usable in <img>/<video> src.
 *
 * Uses local media cache for instant display (秒下).
 */
export function fetchMediaBlobUrlEffect(mxcUrl: string, width?: number, height?: number): DesktopEffect<string> {
  return Effect.gen(function* () {
    const instantBlobUrl = getInstantMediaBlobUrl(mxcUrl, width, height)
    if (instantBlobUrl) return instantBlobUrl

    const blob = yield* fetchMediaBlobEffect(mxcUrl, width, height)
    return blob ? (rememberInstantMediaBlobUrl(mxcUrl, blob, width, height) ?? URL.createObjectURL(blob)) : ''
  })
}

export function fetchMediaBlobUrl(mxcUrl: string, width?: number, height?: number): Promise<string> {
  return runDesktopEffect(fetchMediaBlobUrlEffect(mxcUrl, width, height))
}

function fetchMediaBlobEffect(mxcUrl: string, width?: number, height?: number): DesktopEffect<Blob | null> {
  return Effect.gen(function* () {
    // 秒下: check local cache first
    const cached = yield* fromPromise(() => getCachedMedia(mxcUrl, width, height))
    if (cached) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug(`[media] cache hit ${mxcUrl} size=${cached.size}`)
      }
      return cached
    }

    if (isHttpMediaUrl(mxcUrl)) {
      if (width && height) {
        const originalCached = yield* fromPromise(() => getCachedMedia(mxcUrl))
        if (originalCached) return originalCached
      }

      const response = yield* fetchMediaResponseEffect(mxcUrl, {})
      if (!response.ok) return null
      const contentType = response.headers.get('content-type') || 'application/octet-stream'
      const buf = yield* fromPromise(() => response.arrayBuffer())
      const blob = new Blob([buf], { type: contentType })
      if (blob.size < 5 * 1024 * 1024) {
        void runDesktopEffect(
          fromPromise(() => cacheMedia(mxcUrl, blob, width, height)).pipe(Effect.catchAll(() => Effect.void)),
        )
        if (width && height) {
          void runDesktopEffect(fromPromise(() => cacheMedia(mxcUrl, blob)).pipe(Effect.catchAll(() => Effect.void)))
        }
      }
      return blob
    }

    const client = getClient()
    const token = client.getAccessToken()
    const baseUrl = client.baseUrl

    // Parse mxc://server/mediaId
    if (!mxcUrl.startsWith('mxc://')) return null
    const parts = mxcUrl.slice(6).split('/')
    const serverName = parts[0]
    const mediaId = parts[1]
    if (!serverName || !mediaId) return null

    const thumbParams = width && height ? `?width=${width}&height=${height}&method=crop` : ''
    const isThumbnail = !!(width && height)

    const urls = [
      // Authenticated endpoint
      `${baseUrl}/_matrix/client/v1/media/${isThumbnail ? 'thumbnail' : 'download'}/${serverName}/${mediaId}${thumbParams}`,
      // Legacy endpoint
      `${baseUrl}/_matrix/media/v3/${isThumbnail ? 'thumbnail' : 'download'}/${serverName}/${mediaId}${thumbParams}`,
      // Fallback: if thumbnail 404, try full download
      ...(isThumbnail
        ? [
            `${baseUrl}/_matrix/client/v1/media/download/${serverName}/${mediaId}`,
            `${baseUrl}/_matrix/media/v3/download/${serverName}/${mediaId}`,
          ]
        : []),
    ]

    for (const url of urls) {
      const blob = yield* Effect.gen(function* () {
        const res = yield* fetchMediaResponseEffect(url, token ? { Authorization: `Bearer ${token}` } : {})
        if (!res.ok) {
          return null
        }
        const contentType = res.headers.get('content-type') || 'application/octet-stream'
        const buf = yield* fromPromise(() => res.arrayBuffer())
        const blob = new Blob([buf], { type: contentType })
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.debug(`[media] OK ${url} blob size=${blob.size} type=${blob.type}`)
        }

        // 秒下: cache for instant future access
        if (!isThumbnail || blob.size < 5 * 1024 * 1024) {
          void runDesktopEffect(
            fromPromise(() => cacheMedia(mxcUrl, blob, width, height)).pipe(Effect.catchAll(() => Effect.void)),
          )
        }

        return blob
      }).pipe(Effect.catchAll(() => Effect.succeed(null)))
      if (blob) return blob
    }
    return null
  })
}

interface VideoMeta {
  thumbnail: Blob
  width: number
  height: number
  duration: number
  thumbnailBlurhash?: string
}

interface ImageMeta {
  width: number
  height: number
  blurhash?: string
}

export function extractImageMetaEffect(file: File | Blob): DesktopEffect<ImageMeta> {
  return fromPromise(
    () =>
      new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const image = new Image()

        image.onload = () => {
          URL.revokeObjectURL(url)
          if (image.naturalWidth > 0 && image.naturalHeight > 0) {
            resolve({
              width: image.naturalWidth,
              height: image.naturalHeight,
              blurhash: encodeBlurhashFromImage(image, image.naturalWidth, image.naturalHeight),
            })
            return
          }
          reject(new Error('Failed to read image dimensions'))
        }

        image.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load image for metadata'))
        }

        image.src = url
      }),
  )
}

export function extractImageMeta(file: File | Blob): Promise<ImageMeta> {
  return runDesktopEffect(extractImageMetaEffect(file))
}

export function extractVideoMetaEffect(file: File | Blob): DesktopEffect<VideoMeta> {
  return fromPromise(
    () =>
      new Promise((resolve, reject) => {
        const video = document.createElement('video')
        video.preload = 'auto'
        video.muted = true
        video.playsInline = true
        const url = URL.createObjectURL(file)
        video.src = url

        video.onloadeddata = () => {
          video.currentTime = Math.min(1, video.duration / 4)
        }

        video.onseeked = () => {
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(video, 0, 0)
          canvas.toBlob(
            (blob) => {
              URL.revokeObjectURL(url)
              if (blob) {
                resolve({
                  thumbnail: blob,
                  width: video.videoWidth,
                  height: video.videoHeight,
                  duration: Math.round(video.duration * 1000),
                  thumbnailBlurhash: encodeBlurhashFromImage(canvas, video.videoWidth, video.videoHeight),
                })
              } else {
                reject(new Error('Failed to generate thumbnail'))
              }
            },
            'image/jpeg',
            0.7,
          )
        }

        video.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load video for thumbnail'))
        }
      }),
  )
}

export function extractVideoMeta(file: File | Blob): Promise<VideoMeta> {
  return runDesktopEffect(extractVideoMetaEffect(file))
}

export function downloadMediaEffect(mxcUrl: string): DesktopEffect<Blob> {
  return Effect.gen(function* () {
    const blob = yield* fetchMediaBlobEffect(mxcUrl)
    if (!blob) return yield* Effect.fail(new Error('Failed to download media'))
    return blob
  })
}

export function downloadMedia(mxcUrl: string): Promise<Blob> {
  return runDesktopEffect(downloadMediaEffect(mxcUrl))
}
