import { extractVideoMeta, sendAudioMessage, sendFileMessage, sendImageMessage, sendVideoMessage } from '@matrix/index'
import { ref } from 'vue'

export function useMediaUpload(roomId: () => string | null) {
  const uploading = ref(false)
  const progress = ref(0)

  async function uploadImage(file: File) {
    const id = roomId()
    if (!id)
      return
    uploading.value = true
    progress.value = 0
    try {
      progress.value = 50
      await sendImageMessage(id, file)
      progress.value = 100
    }
    finally {
      uploading.value = false
    }
  }

  async function uploadVideo(file: File) {
    const id = roomId()
    if (!id)
      return
    uploading.value = true
    progress.value = 0
    try {
      let meta
      try {
        meta = await extractVideoMeta(file)
      }
      catch (e) {
        console.warn('[upload] failed to extract video meta', e)
      }
      progress.value = 30
      await sendVideoMessage(id, file, meta)
      progress.value = 100
    }
    finally {
      uploading.value = false
    }
  }

  async function uploadAudio(blob: Blob, duration: number) {
    const id = roomId()
    if (!id)
      return
    uploading.value = true
    progress.value = 0
    try {
      progress.value = 50
      await sendAudioMessage(id, blob, duration)
      progress.value = 100
    }
    finally {
      uploading.value = false
    }
  }

  async function uploadFile(file: File) {
    const id = roomId()
    if (!id)
      return
    uploading.value = true
    progress.value = 0
    try {
      progress.value = 50
      await sendFileMessage(id, file)
      progress.value = 100
    }
    finally {
      uploading.value = false
    }
  }

  return { uploading, progress, uploadImage, uploadVideo, uploadAudio, uploadFile }
}
