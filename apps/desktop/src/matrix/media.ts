import { fetch as desktopFetch } from '@/desktop/http'
import { cacheMedia, getCachedMedia } from '@/features/chat/lib/mediaCache'
import { getClient } from './client'

async function fetchMediaResponse(url: string, headers: Record<string, string>): Promise<Response> {
  try {
    return (await desktopFetch(url, { headers })) as Response
  } catch {
    return fetch(url, { headers })
  }
}

export async function uploadMedia(file: File | Blob): Promise<string> {
  const response = await getClient().uploadContent(file, {
    type: file.type,
  })
  return response.content_uri
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
export async function fetchMediaBlobUrl(mxcUrl: string, width?: number, height?: number): Promise<string> {
  const blob = await fetchMediaBlob(mxcUrl, width, height)
  return blob ? URL.createObjectURL(blob) : ''
}

async function fetchMediaBlob(mxcUrl: string, width?: number, height?: number): Promise<Blob | null> {
  // 秒下: check local cache first
  const cached = await getCachedMedia(mxcUrl, width, height)
  if (cached) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug(`[media] cache hit ${mxcUrl} size=${cached.size}`)
    }
    return cached
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
    try {
      const res = await fetchMediaResponse(url, token ? { Authorization: `Bearer ${token}` } : {})
      if (!res.ok) {
        continue
      }
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const buf = await res.arrayBuffer()
      const blob = new Blob([buf], { type: contentType })
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug(`[media] OK ${url} blob size=${blob.size} type=${blob.type}`)
      }

      // 秒下: cache for instant future access
      if (!isThumbnail || blob.size < 5 * 1024 * 1024) {
        void cacheMedia(mxcUrl, blob, width, height)
      }

      return blob
    } catch {
      continue
    }
  }
  return null
}

interface VideoMeta {
  thumbnail: Blob
  width: number
  height: number
  duration: number
}

interface ImageMeta {
  width: number
  height: number
}

export function extractImageMeta(file: File | Blob): Promise<ImageMeta> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(url)
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        resolve({
          width: image.naturalWidth,
          height: image.naturalHeight,
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
  })
}

export function extractVideoMeta(file: File | Blob): Promise<VideoMeta> {
  return new Promise((resolve, reject) => {
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
  })
}

export async function downloadMedia(mxcUrl: string): Promise<Blob> {
  const blob = await fetchMediaBlob(mxcUrl)
  if (!blob) throw new Error('Failed to download Matrix media')
  return blob
}
