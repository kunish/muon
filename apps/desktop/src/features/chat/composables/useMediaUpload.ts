import type { PendingUpload } from '../lib/uploadManager'
import { extractVideoMeta, sendAudioMessage, sendFileMessage, sendImageMessage, sendVideoMessage } from '@matrix/index'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
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
  function stageFile(id: string, file: File): Promise<PendingUpload> {
    return uploadManager.stageFile(id, file)
  }

  function getUpload(id: string): PendingUpload | undefined {
    return uploadManager.getUpload(id)
  }

  function getPendingUploads(): PendingUpload[] {
    return uploadManager.getAll()
  }

  function allDone(ids: string[]): boolean {
    return uploadManager.allDone(ids)
  }

  function waitForAll(ids: string[]): Promise<PendingUpload[]> {
    return uploadManager.waitForAll(ids)
  }

  function collectCompleted(ids: string[]): PendingUpload[] {
    return uploadManager.collectCompleted(ids)
  }

  function removeUpload(id: string) {
    uploadManager.removeUpload(id)
  }

  function clearUploads() {
    uploadManager.clear()
    uploading.value = false
    progress.value = 0
  }

  async function withUpload(fn: (id: string) => Promise<unknown>) {
    const id = roomId()
    if (!id) return
    uploading.value = true
    progress.value = 0
    try {
      progress.value = 50
      await fn(id)
      progress.value = 100
    } catch {
      toast.error(t('chat.upload_failed'))
    } finally {
      uploading.value = false
    }
  }

  async function uploadImage(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('chat.file_too_large'))
      return
    }
    if (!file.type.startsWith('image/')) {
      toast.error(t('chat.invalid_file_type'))
      return
    }
    await withUpload((id) => sendImageMessage(id, file))
  }

  async function uploadVideo(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('chat.file_too_large'))
      return
    }
    await withUpload(async (id) => {
      let meta
      try {
        meta = await extractVideoMeta(file)
      } catch (e) {
        console.warn('[upload] failed to extract video meta', e)
      }
      progress.value = 30
      await sendVideoMessage(id, file, meta)
    })
  }

  async function uploadAudio(blob: Blob, duration: number) {
    await withUpload((id) => sendAudioMessage(id, blob, duration))
  }

  async function uploadFile(file: File) {
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('chat.file_too_large'))
      return
    }
    await withUpload((id) => sendFileMessage(id, file))
  }

  return {
    uploading,
    progress,
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
