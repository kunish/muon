import { ref } from 'vue'

export function useVoiceRecorder() {
  const isRecording = ref(false)
  const duration = ref(0)
  const audioBlob = ref<Blob | null>(null)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  async function start() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    recorder = new MediaRecorder(stream)
    chunks = []
    duration.value = 0
    audioBlob.value = null

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0)
        chunks.push(e.data)
    }

    recorder.onstop = () => {
      audioBlob.value = new Blob(chunks, { type: 'audio/webm' })
      stream.getTracks().forEach((t) => { t.stop() })
      if (timer)
        clearInterval(timer)
    }

    recorder.start()
    isRecording.value = true
    timer = setInterval(() => {
      duration.value++
    }, 1000)
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (recorder?.state === 'recording') {
        recorder.addEventListener('stop', () => {
          resolve(audioBlob.value)
        }, { once: true })
        recorder.stop()
        isRecording.value = false
      }
      else {
        resolve(audioBlob.value)
      }
    })
  }

  function cancel() {
    if (recorder?.state === 'recording') {
      // 清空 chunks 在 stop 触发前，这样 onstop 产生的 blob 无内容
      chunks = []
      recorder.stop()
      isRecording.value = false
    }
    audioBlob.value = null
  }

  return { isRecording, duration, start, stop, cancel }
}
