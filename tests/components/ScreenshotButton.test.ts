import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ScreenshotButton from '@/features/chat/components/ScreenshotButton.vue'

const screenshotMocks = vi.hoisted(() => ({
  captureScreen: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

vi.mock('@/electron/screenshot', () => ({
  captureScreen: screenshotMocks.captureScreen,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

describe('screenshotButton', () => {
  beforeEach(() => {
    screenshotMocks.captureScreen.mockReset()
    toastMocks.error.mockReset()
  })

  it('shows a localized error when screenshot capture is unavailable', async () => {
    screenshotMocks.captureScreen.mockResolvedValueOnce(null)
    const wrapper = mount(ScreenshotButton)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('截图失败')
    expect(wrapper.emitted('capture')).toBeUndefined()
  })

  it('emits a file when screenshot capture succeeds', async () => {
    screenshotMocks.captureScreen.mockResolvedValueOnce(new Blob(['png'], { type: 'image/png' }))
    const wrapper = mount(ScreenshotButton)

    await wrapper.get('button').trigger('click')
    await flushPromises()

    const emitted = wrapper.emitted('capture')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toBeInstanceOf(File)
    expect(toastMocks.error).not.toHaveBeenCalled()
  })
})
