import { decode, isBlurhashValid } from 'blurhash'

export const BLURHASH_INFO_KEY = 'com.muon.blurhash' as const
const DEFAULT_PLACEHOLDER_WIDTH = 32
const DEFAULT_PLACEHOLDER_HEIGHT = 32

const dataUrlCache = new Map<string, string>()

export function readBlurhash(info: unknown): string | null {
  if (!info || typeof info !== 'object') return null

  const record = info as Record<string, unknown>
  const blurhash = record[BLURHASH_INFO_KEY]
  return typeof blurhash === 'string' && blurhash ? blurhash : null
}

export function blurhashToDataUrl(
  blurhash: string,
  width = DEFAULT_PLACEHOLDER_WIDTH,
  height = DEFAULT_PLACEHOLDER_HEIGHT,
): string | null {
  if (!blurhash || width <= 0 || height <= 0) return null

  const cacheKey = `${blurhash}:${width}x${height}`
  const cached = dataUrlCache.get(cacheKey)
  if (cached) return cached

  const validation = isBlurhashValid(blurhash)
  if (!validation.result) return null

  try {
    const pixels = decode(blurhash, width, height)
    const dataUrl = pixelsToCanvasDataUrl(pixels, width, height) ?? pixelsToSvgDataUrl(pixels, width, height)
    dataUrlCache.set(cacheKey, dataUrl)
    return dataUrl
  } catch {
    return null
  }
}

function pixelsToCanvasDataUrl(pixels: Uint8ClampedArray, width: number, height: number): string | null {
  if (typeof document === 'undefined') return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return null

    const imageData = context.createImageData(width, height)
    imageData.data.set(pixels)
    context.putImageData(imageData, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

function pixelsToSvgDataUrl(pixels: Uint8ClampedArray, width: number, height: number): string {
  const [r, g, b] = averageRgb(pixels)
  const fill = `rgb(${r} ${g} ${b})`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${fill}"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function averageRgb(pixels: Uint8ClampedArray): [number, number, number] {
  if (pixels.length < 4) return [229, 231, 235]

  let r = 0
  let g = 0
  let b = 0
  let count = 0

  for (let i = 0; i < pixels.length; i += 4) {
    r += pixels[i] ?? 0
    g += pixels[i + 1] ?? 0
    b += pixels[i + 2] ?? 0
    count += 1
  }

  return [Math.round(r / count), Math.round(g / count), Math.round(b / count)]
}
