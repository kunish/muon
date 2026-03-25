import { extractVideoMeta, sendAudioMessage, sendFileMessage, sendImageMessage, sendVideoMessage } from '@matrix/index'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'

export function useMediaUpload(roomId: () => string | null) {
  const { t } = useI18n()
  const uploading = ref(false)
  const progress = ref(0)

  async function withUpload(fn: (id: string) => Promise<unknown>) {
    const id = roomId()
    if (!id)
      return
    uploading.value = true
    progress.value = 0
    try {
      progress.value = 50
      await fn(id)
      progress.value = 100
    }
    catch {
      toast.error(t('chat.upload_failed'))
    }
    finally {
      uploading.value = false
    }
  }

  async function uploadImage(file: File) {
    await withUpload(id => sendImageMessage(id, file))
  }

  async function uploadVideo(file: File) {
    await withUpload(async (id) => {
      let meta
      try {
        meta = await extractVideoMeta(file)
      }
      catch (e) {
        console.warn('[upload] failed to extract video meta', e)
      }
      progress.value = 30
      await sendVideoMessage(id, file, meta)
    })
  }

  async function uploadAudio(blob: Blob, duration: number) {
    await withUpload(id => sendAudioMessage(id, blob, duration))
  }

  async function uploadFile(file: File) {
    await withUpload(id => sendFileMessage(id, file))
  }

  return { uploading, progress, uploadImage, uploadVideo, uploadAudio, uploadFile }
}
