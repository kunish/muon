import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMediaBlobUrlMock, getInstantMediaBlobUrlMock, openVideoMock } = vi.hoisted(() => ({
  fetchMediaBlobUrlMock: vi.fn(),
  getInstantMediaBlobUrlMock: vi.fn(() => null),
  openVideoMock: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  fetchMediaBlobUrl: fetchMediaBlobUrlMock,
  getInstantMediaBlobUrl: getInstantMediaBlobUrlMock,
}))

vi.mock('@/features/chat/composables/useMediaViewer', () => ({
  useMediaViewer: () => ({
    openVideo: openVideoMock,
  }),
}))

function createVideoEvent(content: Record<string, unknown>): MatrixEvent {
  return {
    getContent: () => content,
  } as unknown as MatrixEvent
}

describe('video message instant media rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMediaBlobUrlMock.mockReset()
    getInstantMediaBlobUrlMock.mockReset()
    openVideoMock.mockReset()
    getInstantMediaBlobUrlMock.mockReturnValue(null)
  })

  it('uses an instant uploaded blob URL before async media loading resolves', async () => {
    getInstantMediaBlobUrlMock.mockReturnValue('blob:instant-video')
    fetchMediaBlobUrlMock.mockReturnValue(new Promise(() => {}))

    const VideoMessage = (await import('@/features/chat/components/messages/VideoMessage.vue')).default
    const wrapper = mount(VideoMessage, {
      props: {
        event: createVideoEvent({
          msgtype: 'm.video',
          body: 'demo.mp4',
          url: 'https://s3.kunish.eu.org/bkt1/media/demo.mp4',
          info: {
            mimetype: 'video/mp4',
            w: 640,
            h: 360,
            duration: 3000,
          },
        }),
      },
    })

    expect(getInstantMediaBlobUrlMock).toHaveBeenCalledWith('https://s3.kunish.eu.org/bkt1/media/demo.mp4')
    expect(wrapper.get('video').attributes('src')).toBe('blob:instant-video#t=0.1')
    expect(wrapper.find('.animate-pulse').exists()).toBe(false)

    wrapper.unmount()
  })
})
