import { getCurrentWindow } from '@tauri-apps/api/window'

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function stopAllTracks(stream: MediaStream | null): void {
  if (!stream)
    return
  for (const track of stream.getTracks())
    track.stop()
}

export async function captureScreen(): Promise<Blob | null> {
  if (!navigator.mediaDevices?.getDisplayMedia)
    return null

  const appWindow = getCurrentWindow()

  let stream: MediaStream | null = null
  try {
    // 隐藏窗口，避免截到自身
    await appWindow.hide()
    await delay(300)

    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'monitor' } as any,
      audio: false,
    })

    const track = stream.getVideoTracks()[0]
    if (!track)
      return null

    // 通过 video 元素截取一帧到 canvas
    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()

    // 等待一帧渲染
    await delay(100)

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)

    video.pause()
    video.srcObject = null

    return await new Promise<Blob | null>(resolve =>
      canvas.toBlob(blob => resolve(blob), 'image/png'),
    )
  }
  catch {
    return null
  }
  finally {
    stopAllTracks(stream)
    await appWindow.show()
    await appWindow.setFocus()
  }
}
