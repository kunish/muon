import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { getClient } from './client'

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
 * Fetch media via Tauri HTTP plugin (bypasses webview CORS/auth issues)
 * and return a blob: URL usable in <img>/<video> src.
 */
export async function fetchMediaBlobUrl(mxcUrl: string, width?: number, height?: number): Promise<string> {
  const client = getClient()
  const token = client.getAccessToken()
  const baseUrl = client.baseUrl

  // Parse mxc://server/mediaId
  if (!mxcUrl.startsWith('mxc://'))
    return ''
  const parts = mxcUrl.slice(6).split('/')
  const serverName = parts[0]
  const mediaId = parts[1]
  if (!serverName || !mediaId)
    return ''

  const thumbParams = (width && height) ? `?width=${width}&height=${height}&method=crop` : ''
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
      const res = await tauriFetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
      if (!res.ok) {
        console.warn(`[media] ${res.status} ${url}`)
        continue
      }
      const contentType = res.headers.get('content-type') || 'application/octet-stream'
      const buf = await res.arrayBuffer()
      const blob = new Blob([buf], { type: contentType })
      if (import.meta.env.DEV)
        // eslint-disable-next-line no-console
        console.debug(`[media] OK ${url} blob size=${blob.size} type=${blob.type}`)
      return URL.createObjectURL(blob)
    }
    catch (e) {
      console.warn('[media] error', url, e)
      continue
    }
  }
  return ''
}

interface VideoMeta {
  thumbnail: Blob
  width: number
  height: number
  duration: number
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
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url)
        if (blob) {
          resolve({
            thumbnail: blob,
            width: video.videoWidth,
            height: video.videoHeight,
            duration: Math.round(video.duration * 1000),
          })
        }
        else {
          reject(new Error('Failed to generate thumbnail'))
        }
      }, 'image/jpeg', 0.7)
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video for thumbnail'))
    }
  })
}

export async function downloadMedia(mxcUrl: string): Promise<Blob> {
  const client = getClient()
  const httpUrl = client.mxcUrlToHttp(mxcUrl) || ''
  const token = client.getAccessToken()
  const res = await tauriFetch(httpUrl, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  return res.blob()
}
