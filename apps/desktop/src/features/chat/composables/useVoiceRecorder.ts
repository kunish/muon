import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { toast } from 'vue-sonner'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { localizedText } from '@/shared/lib/localizedText'

export function useVoiceRecorder() {
  const isRecording = ref(false)
  const duration = ref(0)
  const audioBlob = ref<Blob | null>(null)

  let recorder: MediaRecorder | null = null
  let chunks: Blob[] = []
  let timer: ReturnType<typeof setInterval> | null = null

  function startEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      const stream = yield* fromPromise(() => navigator.mediaDevices.getUserMedia({ audio: true }))
      yield* fromSync(() => {
        recorder = new MediaRecorder(stream)
        chunks = []
        duration.value = 0
        audioBlob.value = null

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = () => {
          audioBlob.value = new Blob(chunks, { type: 'audio/webm' })
          stream.getTracks().forEach((t) => {
            t.stop()
          })
          if (timer) clearInterval(timer)
        }

        recorder.start()
        isRecording.value = true
        timer = setInterval(() => {
          duration.value++
        }, 1000)
      })
    }).pipe(
      Effect.catchAll((err) =>
        fromSync(() => {
          console.error('[useVoiceRecorder] Microphone access failed:', err)
          toast.error(localizedText('chat.record_failed'))
        }),
      ),
    )
  }

  function start() {
    return runDesktopEffect(startEffect())
  }

  function stopEffect(): DesktopEffect<Blob | null> {
    return fromPromise(
      () =>
        new Promise((resolve) => {
          if (recorder?.state === 'recording') {
            recorder.addEventListener(
              'stop',
              () => {
                resolve(audioBlob.value)
              },
              { once: true },
            )
            recorder.stop()
            isRecording.value = false
            return
          }

          resolve(audioBlob.value)
        }),
    )
  }

  function stop(): Promise<Blob | null> {
    return runDesktopEffect(stopEffect())
  }

  function cancelEffect(): DesktopEffect<void> {
    return fromSync(() => {
      if (recorder?.state === 'recording') {
        // 清空 chunks 在 stop 触发前，这样 onstop 产生的 blob 无内容
        chunks = []
        recorder.stop()
        isRecording.value = false
      }
      audioBlob.value = null
    })
  }

  function cancel() {
    return runDesktopSync(cancelEffect())
  }

  return { isRecording, duration, startEffect, stopEffect, cancelEffect, start, stop, cancel }
}
