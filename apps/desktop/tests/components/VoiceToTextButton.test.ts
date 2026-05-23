import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import VoiceToTextButton from '@/features/chat/components/VoiceToTextButton.vue'

const speechMocks = vi.hoisted(() => ({
  options: null as null | {
    onEnd: () => void
    onError: (error: string) => void
    onResult: (result: { text: string; isFinal: boolean }) => void
  },
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/shared/lib/speechToText', () => ({
  createSpeechRecognizer: (options: typeof speechMocks.options) => {
    speechMocks.options = options
    return {
      abort: speechMocks.abort,
      start: speechMocks.start,
      stop: speechMocks.stop,
    }
  },
  isSpeechRecognitionSupported: () => true,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

describe('voiceToTextButton', () => {
  beforeEach(() => {
    speechMocks.options = null
    speechMocks.start.mockClear()
    speechMocks.stop.mockClear()
    speechMocks.abort.mockClear()
    toastMocks.error.mockClear()
  })

  it('shows a localized error when speech recognition fails', async () => {
    const wrapper = mount(VoiceToTextButton)

    await wrapper.get('button').trigger('click')
    speechMocks.options?.onError('network')
    await nextTick()

    expect(toastMocks.error).toHaveBeenCalledWith('语音识别失败')
    expect(wrapper.get('button').attributes('title')).toBe('语音转文字')
  })
})
