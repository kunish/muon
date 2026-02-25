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
      stream.getTracks().forEach(t => t.stop())
      if (timer)
        clearInterval(timer)
    }

    recorder.start()
    isRecording.value = true
    timer = setInterval(() => {
      duration.value++
    }, 1000)
  }

  function stop(): Blob | null {
    if (recorder?.state === 'recording') {
      recorder.stop()
      isRecording.value = false
    }
    return audioBlob.value
  }

  function cancel() {
    if (recorder?.state === 'recording') {
      recorder.stop()
      isRecording.value = false
    }
    audioBlob.value = null
    chunks = []
  }

  return { isRecording, duration, audioBlob, start, stop, cancel }
}
