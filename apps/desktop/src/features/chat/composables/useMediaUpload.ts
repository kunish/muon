import type { PendingUpload } from '../lib/uploadManager'
import type { DesktopEffect } from '@/shared/lib/effect'
import { extractVideoMeta, sendAudioMessage, sendFileMessage, sendImageMessage, sendVideoMessage } from '@matrix/index'
import { Effect } from 'effect'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { createUploadManager } from '../lib/uploadManager'

const MAX_FILE_SIZE = 100 * 1024 * 1024

/**
 * Enhanced media upload composable with 秒发 (instant send) support.
 *
 * Key improvements over the original:
 * 1. Pre-upload: files start uploading immediately when staged
 * 2. Per-file progress tracking via uploadManager
 * 3. Hash-based deduplication (SHA-256)
 * 4. Image compression before upload
 * 5. Individual vs aggregate progress modes
 */
export function useMediaUpload(roomId: () => string | null) {
  const { t } = useI18n()
  const uploading = ref(false)
  const progress = ref(0)

  const uploadManager = createUploadManager({
    progress: (_upload) => {
      updateProgress()
    },
    complete: (_upload) => {
      updateProgress()
    },
    error: (upload) => {
      updateProgress()
      toast.error(t('chat.upload_failed'))
      if (import.meta.env.DEV) {
        console.warn(`[upload] failed for ${upload.id}: ${upload.error}`)
      }
    },
  })

  function updateProgress() {
    const all = [...uploadManager.collectCompleted([]), ...getPendingUploads()]
    if (all.length === 0) {
      progress.value = 0
      uploading.value = false
      return
    }
    const totalProgress = all.reduce((sum, u) => sum + u.progress, 0)
    progress.value = Math.round(totalProgress / all.length)
    uploading.value = all.some((u) => u.status !== 'done' && u.status !== 'error')
  }

  /** Stage a file for pre-upload. Returns the upload object for progress tracking. */
  function stageFileEffect(id: string, file: File): DesktopEffect<PendingUpload> {
    return uploadManager.stageFileEffect(id, file)
  }

  function stageFile(id: string, file: File): Promise<PendingUpload> {
    return runDesktopEffect(stageFileEffect(id, file))
  }

  function getUpload(id: string): PendingUpload | undefined {
    return uploadManager.getUpload(id)
  }

  function getPendingUploads(): PendingUpload[] {
    return uploadManager.getAll()
  }

  function allDoneEffect(ids: string[]): DesktopEffect<boolean> {
    return uploadManager.allDoneEffect(ids)
  }

  function allDone(ids: string[]): boolean {
    return runDesktopSync(allDoneEffect(ids))
  }

  function waitForAllEffect(ids: string[]): DesktopEffect<PendingUpload[]> {
    return uploadManager.waitForAllEffect(ids)
  }

  function waitForAll(ids: string[]): Promise<PendingUpload[]> {
    return runDesktopEffect(waitForAllEffect(ids))
  }

  function collectCompletedEffect(ids: string[]): DesktopEffect<PendingUpload[]> {
    return uploadManager.collectCompletedEffect(ids)
  }

  function collectCompleted(ids: string[]): PendingUpload[] {
    return runDesktopSync(collectCompletedEffect(ids))
  }

  function removeUploadEffect(id: string): DesktopEffect<void> {
    return uploadManager.removeUploadEffect(id)
  }

  function removeUpload(id: string) {
    return runDesktopSync(removeUploadEffect(id))
  }

  function clearUploadsEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      yield* uploadManager.clearEffect()
      yield* fromSync(() => {
        uploading.value = false
        progress.value = 0
      })
    })
  }

  function clearUploads() {
    return runDesktopSync(clearUploadsEffect())
  }

  function withUploadEffect(fn: (id: string) => DesktopEffect<unknown>): DesktopEffect<void> {
    return Effect.gen(function* () {
      const id = roomId()
      if (!id) return
      yield* fromSync(() => {
        uploading.value = true
        progress.value = 0
      })

      yield* fromSync(() => {
        progress.value = 50
      })
      const succeeded = yield* fn(id).pipe(
        Effect.as(true),
        Effect.catchAll(() =>
          fromSync(() => {
            toast.error(t('chat.upload_failed'))
            return false
          }),
        ),
      )
      if (succeeded) {
        yield* fromSync(() => {
          progress.value = 100
        })
      }
    }).pipe(Effect.ensuring(Effect.sync(() => void (uploading.value = false))))
  }

  function uploadImageEffect(file: File): DesktopEffect<void> {
    if (file.size > MAX_FILE_SIZE) return fromSync(() => toast.error(t('chat.file_too_large')))
    if (!file.type.startsWith('image/')) return fromSync(() => toast.error(t('chat.invalid_file_type')))
    return withUploadEffect((id) => fromPromise(() => sendImageMessage(id, file)))
  }

  function uploadImage(file: File) {
    return runDesktopEffect(uploadImageEffect(file))
  }

  function uploadVideoEffect(file: File): DesktopEffect<void> {
    if (file.size > MAX_FILE_SIZE) return fromSync(() => toast.error(t('chat.file_too_large')))
    return withUploadEffect((id) =>
      Effect.gen(function* () {
        const meta = yield* fromPromise(() => extractVideoMeta(file)).pipe(
          Effect.catchAll((e) =>
            fromSync(() => {
              console.warn('[upload] failed to extract video meta', e)
              return undefined
            }),
          ),
        )
        yield* fromSync(() => {
          progress.value = 30
        })
        yield* fromPromise(() => sendVideoMessage(id, file, meta))
      }),
    )
  }

  function uploadVideo(file: File) {
    return runDesktopEffect(uploadVideoEffect(file))
  }

  function uploadAudioEffect(blob: Blob, duration: number): DesktopEffect<void> {
    return withUploadEffect((id) => fromPromise(() => sendAudioMessage(id, blob, duration)))
  }

  function uploadAudio(blob: Blob, duration: number) {
    return runDesktopEffect(uploadAudioEffect(blob, duration))
  }

  function uploadFileEffect(file: File): DesktopEffect<void> {
    if (file.size > MAX_FILE_SIZE) return fromSync(() => toast.error(t('chat.file_too_large')))
    return withUploadEffect((id) => fromPromise(() => sendFileMessage(id, file)))
  }

  function uploadFile(file: File) {
    return runDesktopEffect(uploadFileEffect(file))
  }

  return {
    uploading,
    progress,
    uploadImageEffect,
    uploadVideoEffect,
    uploadAudioEffect,
    uploadFileEffect,
    stageFileEffect,
    allDoneEffect,
    waitForAllEffect,
    collectCompletedEffect,
    removeUploadEffect,
    clearUploadsEffect,
    withUploadEffect,
    uploadImage,
    uploadVideo,
    uploadAudio,
    uploadFile,
    stageFile,
    getUpload,
    getPendingUploads,
    allDone,
    waitForAll,
    collectCompleted,
    removeUpload,
    clearUploads,
  }
}
