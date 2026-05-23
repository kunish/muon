import type { CSSProperties } from 'vue'

interface MediaInfoLike {
  w?: unknown
  h?: unknown
}

export interface MediaFrameOptions {
  maxWidth: number
  maxHeight: number
  fallbackWidth?: number
  fallbackHeight?: number
}

function toPositiveNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : null
}

export function getMediaFrameStyle(info: MediaInfoLike | undefined, options: MediaFrameOptions): CSSProperties {
  const metadataWidth = toPositiveNumber(info?.w)
  const metadataHeight = toPositiveNumber(info?.h)
  const width = metadataWidth ?? options.fallbackWidth ?? options.maxWidth
  const height = metadataHeight ?? options.fallbackHeight ?? options.maxHeight
  const scale = Math.min(options.maxWidth / width, options.maxHeight / height, 1)

  return {
    width: `${Math.round(width * scale)}px`,
    maxWidth: '100%',
    aspectRatio: `${width} / ${height}`,
  }
}
