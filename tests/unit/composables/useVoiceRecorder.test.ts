import { beforeEach, describe, expect, it, vi } from 'vitest'

const mediaMocks = vi.hoisted(() => ({
  getUserMedia: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

describe('useVoiceRecorder', () => {
  beforeEach(() => {
    mediaMocks.getUserMedia.mockReset()
    toastMocks.error.mockReset()
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: mediaMocks.getUserMedia,
      },
    })
    vi.resetModules()
  })

  it('shows a localized error when microphone access fails', async () => {
    mediaMocks.getUserMedia.mockRejectedValueOnce(new Error('permission denied'))
    const { useVoiceRecorder } = await import('@/features/chat/composables/useVoiceRecorder')
    const recorder = useVoiceRecorder()

    await recorder.start()

    expect(toastMocks.error).toHaveBeenCalledWith('启动录音失败')
    expect(recorder.isRecording.value).toBe(false)
  })
})
