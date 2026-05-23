import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getCurrentWindow } from './window'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function stopAllTracks(stream: MediaStream | null): void {
  if (!stream) return
  for (const track of stream.getTracks()) track.stop()
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export function captureScreenEffect(): DesktopEffect<Blob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) return Effect.succeed(null)

  const appWindow = getCurrentWindow()
  let stream: MediaStream | null = null

  return Effect.gen(function* () {
    yield* fromPromise(() => appWindow.hide())
    yield* fromPromise(() => delay(300))

    stream = yield* fromPromise(() =>
      navigator.mediaDevices.getDisplayMedia({
        audio: false,
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
      }),
    )

    const track = stream.getVideoTracks()[0]
    if (!track) return null

    const video = yield* fromSync(() => document.createElement('video'))
    yield* fromSync(() => {
      video.srcObject = stream
      video.muted = true
    })
    yield* fromPromise(() => video.play())

    yield* fromPromise(() => delay(100))

    const canvas = yield* fromSync(() => document.createElement('canvas'))
    yield* fromSync(() => {
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(video, 0, 0)

      video.pause()
      video.srcObject = null
    })

    return yield* fromPromise(() => canvasToBlob(canvas))
  }).pipe(
    Effect.catchAll(() => Effect.succeed(null)),
    Effect.ensuring(
      Effect.gen(function* () {
        yield* fromSync(() => stopAllTracks(stream))
        yield* fromPromise(() => appWindow.show())
        yield* fromPromise(() => appWindow.setFocus())
      }).pipe(Effect.catchAll(() => Effect.void)),
    ),
  )
}

export function captureScreen(): Promise<Blob | null> {
  return runDesktopEffect(captureScreenEffect())
}
