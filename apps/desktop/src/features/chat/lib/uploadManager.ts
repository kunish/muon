/**
 * Upload manager implementing 秒发 (instant send) via pre-upload.
 *
 * Key features from Feishu analysis applied to muon:
 * 1. Pre-upload: upload starts immediately when file enters composer
 * 2. Hash dedup: SHA-256 hash to detect duplicate uploads
 * 3. Per-file progress: individual progress tracking for each file
 * 4. Upload reuse: if same file was already uploaded, reuse the URL
 *
 * Architecture:
 *   paste/drag → stage → hash → (compress) → upload start → progress emit
 *   send click → collect completed uploads → build message → send
 */

import { uploadMedia } from '@/matrix/media'
import { computeSha256 } from '@/shared/lib/utils'
import { canCompress, compressImage } from './imageCompressor'

export interface PendingUpload {
  /** Unique ID matching the pending attachment */
  id: string
  /** Original file */
  file: File
  /** Upload progress 0–100 */
  progress: number
  /** Completed mxc:// URL (null until upload finishes) */
  mxcUrl: string | null
  /** SHA-256 hex hash of the file content */
  hash: string | null
  /** Image dimensions (for images only) */
  width?: number
  height?: number
  /** Whether compression was applied */
  compressed: boolean
  /** Original file size */
  originalSize: number
  /** Compressed/uploaded size */
  uploadSize: number
  /** Upload status */
  status: 'pending' | 'hashing' | 'compressing' | 'uploading' | 'done' | 'error'
  /** Error message if status is 'error' */
  error?: string
  /** The file that will actually be uploaded (compressed or original) */
  uploadFile: File | Blob
}

export interface UploadManagerEvents {
  progress: (upload: PendingUpload) => void
  complete: (upload: PendingUpload) => void
  error: (upload: PendingUpload) => void
}

/**
 * In-memory hash → mxcUrl cache for session deduplication.
 * If the same file (same SHA-256 hash) was uploaded in this session, reuse the URL.
 */
const hashDedupCache = new Map<string, string>()

export function createUploadManager(on: UploadManagerEvents) {
  const pendingUploads = new Map<string, PendingUpload>()

  async function stageFile(id: string, file: File): Promise<PendingUpload> {
    const upload: PendingUpload = {
      id,
      file,
      progress: 0,
      mxcUrl: null,
      hash: null,
      compressed: false,
      originalSize: file.size,
      uploadSize: file.size,
      status: 'pending',
      uploadFile: file,
    }

    pendingUploads.set(id, upload)

    // Start upload immediately — this is the 秒发 key
    startUpload(upload)

    return upload
  }

  async function startUpload(upload: PendingUpload) {
    try {
      // Step 1: Compute SHA-256 hash for dedup
      upload.status = 'hashing'
      on.progress(upload)

      const hash = await computeSha256(upload.file)
      upload.hash = hash

      // Check dedup cache
      const cachedUrl = hashDedupCache.get(hash)
      if (cachedUrl) {
        upload.mxcUrl = cachedUrl
        upload.progress = 100
        upload.status = 'done'
        on.complete(upload)
        return
      }

      // Step 2: Compress images
      if (canCompress(upload.file)) {
        upload.status = 'compressing'
        on.progress(upload)

        try {
          const compressed = await compressImage(upload.file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.85,
            targetSizeKB: 300,
          })
          upload.uploadFile = compressed.blob
          upload.compressed = compressed.compressedSize < compressed.originalSize
          upload.uploadSize = compressed.compressedSize
          if (upload.compressed) {
            upload.width = compressed.width
            upload.height = compressed.height
          }
        } catch {
          upload.uploadFile = upload.file
        }
      }

      upload.status = 'uploading'
      upload.progress = 10
      on.progress(upload)

      const mxcUrl = await uploadMedia(upload.uploadFile)

      upload.mxcUrl = mxcUrl
      upload.progress = 100
      upload.status = 'done'

      hashDedupCache.set(hash, mxcUrl)

      on.complete(upload)
    } catch (err) {
      upload.status = 'error'
      upload.error = err instanceof Error ? err.message : 'Upload failed'
      on.error(upload)
    }
  }

  function getUpload(id: string): PendingUpload | undefined {
    return pendingUploads.get(id)
  }

  /** Get all completed uploads for media IDs in the HTML */
  function collectCompleted(ids: string[]): PendingUpload[] {
    return ids
      .map((id) => pendingUploads.get(id))
      .filter((u): u is PendingUpload => !!u && u.status === 'done' && !!u.mxcUrl)
  }

  /** Check if all specified IDs are done uploading */
  function allDone(ids: string[]): boolean {
    return ids.every((id) => {
      const u = pendingUploads.get(id)
      return u && u.status === 'done' && !!u.mxcUrl
    })
  }

  /** Wait for all specified IDs to complete */
  async function waitForAll(ids: string[]): Promise<PendingUpload[]> {
    const remaining = ids.filter((id) => {
      const u = pendingUploads.get(id)
      return u && u.status !== 'done' && u.status !== 'error'
    })

    if (remaining.length === 0) return collectCompleted(ids)

    return new Promise((resolve) => {
      const check = () => {
        if (allDone(ids)) {
          cleanup()
          resolve(collectCompleted(ids))
          return
        }

        const allFinished = ids.every((id) => {
          const u = pendingUploads.get(id)
          return u && (u.status === 'done' || u.status === 'error')
        })

        if (allFinished) {
          cleanup()
          resolve(collectCompleted(ids))
        }
      }

      const onDone = () => check()
      const originalComplete = on.complete
      const originalError = on.error

      on.complete = (upload) => {
        originalComplete(upload)
        onDone()
      }
      on.error = (upload) => {
        originalError(upload)
        onDone()
      }

      function cleanup() {
        on.complete = originalComplete
        on.error = originalError
      }

      check()
    })
  }

  function removeUpload(id: string) {
    pendingUploads.delete(id)
  }

  function getAll(): PendingUpload[] {
    return [...pendingUploads.values()]
  }

  function clear() {
    pendingUploads.clear()
  }

  return {
    stageFile,
    getUpload,
    collectCompleted,
    allDone,
    waitForAll,
    removeUpload,
    getAll,
    clear,
  }
}

/** Clear the session hash dedup cache */
export function clearHashDedupCache() {
  hashDedupCache.clear()
}

/** Get current dedup cache size */
export function getHashDedupCacheSize() {
  return hashDedupCache.size
}
