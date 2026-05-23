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

import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { uploadMedia } from '@/matrix/media'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
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

  function stageFileEffect(id: string, file: File): DesktopEffect<PendingUpload> {
    return fromSync(() => {
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
      void startUpload(upload)

      return upload
    })
  }

  function stageFile(id: string, file: File): Promise<PendingUpload> {
    return runDesktopEffect(stageFileEffect(id, file))
  }

  function startUploadEffect(upload: PendingUpload): DesktopEffect<void> {
    return Effect.gen(function* () {
      // Step 1: Compute SHA-256 hash for dedup
      yield* fromSync(() => {
        upload.status = 'hashing'
        on.progress(upload)
      })

      const hash = yield* fromPromise(() => computeSha256(upload.file))
      yield* fromSync(() => {
        upload.hash = hash
      })

      // Check dedup cache
      const cachedUrl = yield* fromSync(() => hashDedupCache.get(hash))
      if (cachedUrl) {
        yield* fromSync(() => {
          upload.mxcUrl = cachedUrl
          upload.progress = 100
          upload.status = 'done'
          on.complete(upload)
        })
        return
      }

      // Step 2: Compress images
      if (yield* fromSync(() => canCompress(upload.file))) {
        yield* fromSync(() => {
          upload.status = 'compressing'
          on.progress(upload)
        })

        const compressed = yield* fromPromise(() =>
          compressImage(upload.file, {
            maxWidth: 1920,
            maxHeight: 1920,
            quality: 0.85,
            targetSizeKB: 300,
          }),
        ).pipe(Effect.catchAll(() => Effect.succeed(null)))

        if (compressed) {
          yield* fromSync(() => {
            upload.uploadFile = compressed.blob
            upload.compressed = compressed.compressedSize < compressed.originalSize
            upload.uploadSize = compressed.compressedSize
            if (upload.compressed) {
              upload.width = compressed.width
              upload.height = compressed.height
            }
          })
        } else {
          yield* fromSync(() => {
            upload.uploadFile = upload.file
          })
        }
      }

      yield* fromSync(() => {
        upload.status = 'uploading'
        upload.progress = 10
        on.progress(upload)
      })

      const mxcUrl = yield* fromPromise(() => uploadMedia(upload.uploadFile))

      yield* fromSync(() => {
        upload.mxcUrl = mxcUrl
        upload.progress = 100
        upload.status = 'done'

        hashDedupCache.set(hash, mxcUrl)

        on.complete(upload)
      })
    }).pipe(
      // Keep the manager resilient: failed uploads update state instead of rejecting background work.
      Effect.catchAll((err) =>
        fromSync(() => {
          upload.status = 'error'
          upload.error = err instanceof Error ? err.message : 'Upload failed'
          on.error(upload)
        }),
      ),
    )
  }

  function startUpload(upload: PendingUpload): Promise<void> {
    return runDesktopEffect(startUploadEffect(upload))
  }

  function getUploadEffect(id: string): DesktopEffect<PendingUpload | undefined> {
    return fromSync(() => pendingUploads.get(id))
  }

  function getUpload(id: string): PendingUpload | undefined {
    return runDesktopSync(getUploadEffect(id))
  }

  /** Get all completed uploads for media IDs in the HTML */
  function collectCompletedEffect(ids: string[]): DesktopEffect<PendingUpload[]> {
    return fromSync(() =>
      ids
        .map((id) => pendingUploads.get(id))
        .filter((u): u is PendingUpload => !!u && u.status === 'done' && !!u.mxcUrl),
    )
  }

  function collectCompleted(ids: string[]): PendingUpload[] {
    return runDesktopSync(collectCompletedEffect(ids))
  }

  /** Check if all specified IDs are done uploading */
  function allDoneEffect(ids: string[]): DesktopEffect<boolean> {
    return fromSync(() =>
      ids.every((id) => {
        const u = pendingUploads.get(id)
        return u && u.status === 'done' && !!u.mxcUrl
      }),
    )
  }

  function allDone(ids: string[]): boolean {
    return runDesktopSync(allDoneEffect(ids))
  }

  /** Wait for all specified IDs to complete */
  function waitForAllEffect(ids: string[]): DesktopEffect<PendingUpload[]> {
    return Effect.gen(function* () {
      const remaining = yield* fromSync(() =>
        ids.filter((id) => {
          const u = pendingUploads.get(id)
          return u && u.status !== 'done' && u.status !== 'error'
        }),
      )

      if (remaining.length === 0) return yield* collectCompletedEffect(ids)

      return yield* fromPromise(
        () =>
          new Promise<PendingUpload[]>((resolve) => {
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
          }),
      )
    })
  }

  function waitForAll(ids: string[]): Promise<PendingUpload[]> {
    return runDesktopEffect(waitForAllEffect(ids))
  }

  function removeUploadEffect(id: string): DesktopEffect<void> {
    return fromSync(() => {
      pendingUploads.delete(id)
    })
  }

  function removeUpload(id: string) {
    runDesktopSync(removeUploadEffect(id))
  }

  function getAllEffect(): DesktopEffect<PendingUpload[]> {
    return fromSync(() => [...pendingUploads.values()])
  }

  function getAll(): PendingUpload[] {
    return runDesktopSync(getAllEffect())
  }

  function clearEffect(): DesktopEffect<void> {
    return fromSync(() => pendingUploads.clear())
  }

  function clear() {
    runDesktopSync(clearEffect())
  }

  return {
    stageFileEffect,
    startUploadEffect,
    getUploadEffect,
    collectCompletedEffect,
    allDoneEffect,
    waitForAllEffect,
    removeUploadEffect,
    getAllEffect,
    clearEffect,
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
