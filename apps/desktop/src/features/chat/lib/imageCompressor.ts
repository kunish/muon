/**
 * Image compression utility for pre-upload optimization.
 * Compresses images to reduce upload size and generate thumbnails for instant preview.
 */

import type { DesktopEffect } from '@/shared/lib/effect'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'

interface CompressOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  targetSizeKB?: number
}

interface CompressedImage {
  blob: Blob
  width: number
  height: number
  originalSize: number
  compressedSize: number
}

const DEFAULT_MAX_WIDTH = 1920
const DEFAULT_MAX_HEIGHT = 1920
const DEFAULT_QUALITY = 0.85
const THUMBNAIL_MAX_WIDTH = 540
const THUMBNAIL_QUALITY = 0.7

export function canCompress(file: File | Blob): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml'
}

export function compressImageEffect(file: File | Blob, options: CompressOptions = {}): DesktopEffect<CompressedImage> {
  const {
    maxWidth = DEFAULT_MAX_WIDTH,
    maxHeight = DEFAULT_MAX_HEIGHT,
    quality = DEFAULT_QUALITY,
    targetSizeKB = 300,
  } = options

  return fromPromise(
    () =>
      new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
          URL.revokeObjectURL(url)
          const originalWidth = img.naturalWidth
          const originalHeight = img.naturalHeight

          const { width, height } = calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight)

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')!
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          ctx.drawImage(img, 0, 0, width, height)

          let finalQuality = quality
          const tryCompress = (q: number) => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  canvas.toBlob(
                    (fallback) => {
                      if (!fallback) {
                        reject(new Error('Failed to compress image'))
                        return
                      }
                      resolve({
                        blob: fallback,
                        width,
                        height,
                        originalSize: file.size,
                        compressedSize: fallback.size,
                      })
                    },
                    'image/jpeg',
                    0.6,
                  )
                  return
                }

                if (blob.size > targetSizeKB * 1024 && q > 0.3) {
                  finalQuality = q - 0.15
                  tryCompress(finalQuality)
                  return
                }

                if (blob.size >= file.size && file.type.startsWith('image/jpeg')) {
                  resolve({
                    blob: file as Blob,
                    width: originalWidth,
                    height: originalHeight,
                    originalSize: file.size,
                    compressedSize: file.size,
                  })
                  return
                }

                resolve({
                  blob,
                  width,
                  height,
                  originalSize: file.size,
                  compressedSize: blob.size,
                })
              },
              'image/jpeg',
              q,
            )
          }

          tryCompress(finalQuality)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to load image for compression'))
        }

        img.src = url
      }),
  )
}

export function compressImage(file: File | Blob, options: CompressOptions = {}): Promise<CompressedImage> {
  return runDesktopEffect(compressImageEffect(file, options))
}

export function generateThumbnailEffect(file: File | Blob): DesktopEffect<Blob | null> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return fromPromise(() => Promise.resolve(null))
  }

  return fromPromise(
    () =>
      new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
          resolve(null)
          return
        }

        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
          URL.revokeObjectURL(url)
          const { width, height } = calculateDimensions(
            img.naturalWidth,
            img.naturalHeight,
            THUMBNAIL_MAX_WIDTH,
            THUMBNAIL_MAX_WIDTH,
          )

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')!
          ctx.imageSmoothingEnabled = true
          ctx.drawImage(img, 0, 0, width, height)

          canvas.toBlob((blob) => resolve(blob || null), 'image/jpeg', THUMBNAIL_QUALITY)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve(null)
        }

        img.src = url
      }),
  )
}

export function generateThumbnail(file: File | Blob): Promise<Blob | null> {
  return runDesktopEffect(generateThumbnailEffect(file))
}

export function imageToBase64Effect(file: File | Blob): DesktopEffect<string | null> {
  return fromPromise(
    () =>
      new Promise((resolve) => {
        if (!file.type.startsWith('image/')) {
          resolve(null)
          return
        }

        const url = URL.createObjectURL(file)
        const img = new Image()

        img.onload = () => {
          URL.revokeObjectURL(url)
          const { width, height } = calculateDimensions(
            img.naturalWidth,
            img.naturalHeight,
            THUMBNAIL_MAX_WIDTH,
            THUMBNAIL_MAX_WIDTH,
          )

          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, width, height)

          const base64 = canvas.toDataURL('image/jpeg', THUMBNAIL_QUALITY)
          resolve(base64 || null)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve(null)
        }

        img.src = url
      }),
  )
}

export function imageToBase64(file: File | Blob): Promise<string | null> {
  return runDesktopEffect(imageToBase64Effect(file))
}

function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  let width = originalWidth
  let height = originalHeight

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width)
    width = maxWidth
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height)
    height = maxHeight
  }

  return { width: Math.max(width, 1), height: Math.max(height, 1) }
}
