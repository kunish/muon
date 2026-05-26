import type { MatrixEvent } from 'matrix-js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMediaBlobUrlMock, openVideoMock } = vi.hoisted(() => ({
  fetchMediaBlobUrlMock: vi.fn(),
  openVideoMock: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  fetchMediaBlobUrl: fetchMediaBlobUrlMock,
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

function mockCanvasDataUrl(dataUrl = 'data:image/png;base64,blurhash'): void {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () =>
      ({
        createImageData: (width: number, height: number) => ({
          data: new Uint8ClampedArray(width * height * 4),
        }),
        putImageData: vi.fn(),
      }) as unknown as CanvasRenderingContext2D,
  )
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(dataUrl)
}

describe('video message layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMediaBlobUrlMock.mockReset()
    openVideoMock.mockReset()
  })

  it('renders a blurhash placeholder while video media is loading', async () => {
    mockCanvasDataUrl()
    fetchMediaBlobUrlMock.mockReturnValue(new Promise(() => {}))

    const VideoMessage = (await import('@/features/chat/components/messages/VideoMessage.vue')).default
    const wrapper = mount(VideoMessage, {
      props: {
        event: createVideoEvent({
          msgtype: 'm.video',
          body: 'demo.mp4',
          url: 'mxc://server/video-id',
          info: {
            mimetype: 'video/mp4',
            w: 1920,
            h: 1080,
            duration: 3000,
            'com.muon.blurhash': 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
          },
        }),
      },
    })

    const placeholderStyle = wrapper.get('.animate-pulse').attributes('style') ?? ''
    expect(placeholderStyle).toContain('background-image: url(')
    expect(placeholderStyle).toContain('data:image/')

    wrapper.unmount()
  })

  it('reserves the video frame size from Matrix metadata before media loads', async () => {
    fetchMediaBlobUrlMock.mockResolvedValue('blob:video')

    const VideoMessage = (await import('@/features/chat/components/messages/VideoMessage.vue')).default
    const wrapper = mount(VideoMessage, {
      props: {
        event: createVideoEvent({
          msgtype: 'm.video',
          body: 'demo.mp4',
          url: 'mxc://server/video-id',
          info: {
            mimetype: 'video/mp4',
            w: 1920,
            h: 1080,
            duration: 3000,
          },
        }),
      },
    })

    const frame = wrapper.get('[data-testid="video-message-frame"]')
    expect(frame.attributes('style')).toContain('width: 300px')
    expect(frame.attributes('style')).toContain('max-width: 100%')
    expect(frame.attributes('style')).toContain('aspect-ratio: 1920 / 1080')

    wrapper.unmount()
  })

  it('loads the playable video when thumbnail loading fails', async () => {
    fetchMediaBlobUrlMock.mockRejectedValueOnce(new Error('thumbnail failed')).mockResolvedValueOnce('blob:video')

    const VideoMessage = (await import('@/features/chat/components/messages/VideoMessage.vue')).default
    const wrapper = mount(VideoMessage, {
      props: {
        event: createVideoEvent({
          msgtype: 'm.video',
          body: 'demo.mp4',
          url: 'mxc://server/video-id',
          info: {
            mimetype: 'video/mp4',
            thumbnail_url: 'mxc://server/thumb-id',
            w: 1920,
            h: 1080,
            duration: 3000,
          },
        }),
      },
    })

    await flushPromises()

    expect(fetchMediaBlobUrlMock).toHaveBeenNthCalledWith(1, 'mxc://server/thumb-id', 300, 200)
    expect(fetchMediaBlobUrlMock).toHaveBeenNthCalledWith(2, 'mxc://server/video-id')
    expect(wrapper.get('video').attributes('src')).toBe('blob:video#t=0.1')

    await wrapper.get('[data-testid="video-message-frame"]').trigger('click')
    expect(openVideoMock).toHaveBeenCalledWith('blob:video')

    wrapper.unmount()
  })
})
