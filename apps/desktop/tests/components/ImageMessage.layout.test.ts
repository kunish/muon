import type { MatrixEvent } from 'matrix-js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMediaBlobUrlMock, getInstantMediaBlobUrlMock, openImageMock } = vi.hoisted(() => ({
  fetchMediaBlobUrlMock: vi.fn(),
  getInstantMediaBlobUrlMock: vi.fn(() => null),
  openImageMock: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  fetchMediaBlobUrl: fetchMediaBlobUrlMock,
  getInstantMediaBlobUrl: getInstantMediaBlobUrlMock,
}))

vi.mock('@/features/chat/composables/useMediaViewer', () => ({
  useMediaViewer: () => ({
    openImage: openImageMock,
  }),
}))

function createImageEvent(content: Record<string, unknown>): MatrixEvent {
  return {
    getContent: () => content,
  } as unknown as MatrixEvent
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
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

describe('image message layout', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    fetchMediaBlobUrlMock.mockReset()
    getInstantMediaBlobUrlMock.mockReset()
    openImageMock.mockReset()
    getInstantMediaBlobUrlMock.mockReturnValue(null)
  })

  it('loads http image URLs through the media blob cache pipeline', async () => {
    fetchMediaBlobUrlMock.mockResolvedValue('blob:s3-image')

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'photo.png',
          url: 'https://s3.kunish.eu.org/bkt1/media/photo.png',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
          },
        }),
      },
    })

    await flushPromises()

    expect(fetchMediaBlobUrlMock).toHaveBeenNthCalledWith(1, 'https://s3.kunish.eu.org/bkt1/media/photo.png', 300, 300)
    expect(fetchMediaBlobUrlMock).toHaveBeenNthCalledWith(2, 'https://s3.kunish.eu.org/bkt1/media/photo.png')
    expect(wrapper.get('img').attributes('src')).toBe('blob:s3-image')

    wrapper.unmount()
  })

  it('uses an instant uploaded blob URL before async media loading resolves', async () => {
    getInstantMediaBlobUrlMock.mockReturnValue('blob:instant-s3-image')
    fetchMediaBlobUrlMock.mockReturnValue(new Promise(() => {}))

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'photo.png',
          url: 'https://s3.kunish.eu.org/bkt1/media/photo.png',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
          },
        }),
      },
    })

    expect(getInstantMediaBlobUrlMock).toHaveBeenCalledWith('https://s3.kunish.eu.org/bkt1/media/photo.png', 300, 300)
    expect(wrapper.get('img').attributes('src')).toBe('blob:instant-s3-image')
    expect(wrapper.find('.animate-pulse').exists()).toBe(false)

    wrapper.unmount()
  })

  it('renders a blurhash placeholder while the image is loading', async () => {
    mockCanvasDataUrl()
    fetchMediaBlobUrlMock.mockReturnValue(new Promise(() => {}))

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'photo.png',
          url: 'mxc://server/photo-id',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
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

  it('reserves the GIF frame size before async media loading completes', async () => {
    fetchMediaBlobUrlMock.mockResolvedValue('blob:gif')

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'GIF',
          url: 'mxc://server/gif-id',
          info: {
            mimetype: 'image/gif',
            w: 480,
            h: 270,
          },
        }),
      },
    })

    const frame = wrapper.get('[data-testid="image-message-frame"]')
    expect(frame.attributes('style')).toContain('width: 300px')
    expect(frame.attributes('style')).toContain('max-width: 100%')
    expect(frame.attributes('style')).toContain('aspect-ratio: 480 / 270')

    const placeholder = wrapper.get('.animate-pulse')
    expect(placeholder.classes()).toContain('w-full')
    expect(placeholder.classes()).toContain('h-full')

    await flushPromises()

    const image = wrapper.get('img')
    expect(image.classes()).toContain('w-full')
    expect(image.classes()).toContain('h-full')

    wrapper.unmount()
  })

  it('does not open the image viewer before a full-size source is ready', async () => {
    fetchMediaBlobUrlMock.mockReturnValue(new Promise(() => {}))

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'photo.png',
          url: 'mxc://server/photo-id',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
          },
        }),
      },
    })

    await wrapper.get('[data-testid="image-message-frame"]').trigger('click')

    expect(openImageMock).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('uses the full-size image when thumbnail loading fails', async () => {
    fetchMediaBlobUrlMock.mockRejectedValueOnce(new Error('thumbnail failed')).mockResolvedValueOnce('blob:full-image')

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'photo.png',
          url: 'mxc://server/photo-id',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
          },
        }),
      },
    })

    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('blob:full-image')
    await wrapper.get('[data-testid="image-message-frame"]').trigger('click')
    expect(openImageMock).toHaveBeenCalledWith('blob:full-image')

    wrapper.unmount()
  })

  it('keeps the latest image when an earlier media request resolves later', async () => {
    const firstThumb = deferred<string>()
    const firstFull = deferred<string>()
    const secondThumb = deferred<string>()
    const secondFull = deferred<string>()
    fetchMediaBlobUrlMock
      .mockReturnValueOnce(firstThumb.promise)
      .mockReturnValueOnce(firstFull.promise)
      .mockReturnValueOnce(secondThumb.promise)
      .mockReturnValueOnce(secondFull.promise)

    const ImageMessage = (await import('@/features/chat/components/messages/ImageMessage.vue')).default
    const wrapper = mount(ImageMessage, {
      props: {
        event: createImageEvent({
          msgtype: 'm.image',
          body: 'first.png',
          url: 'mxc://server/first',
          info: {
            mimetype: 'image/png',
            w: 640,
            h: 360,
          },
        }),
      },
    })

    await wrapper.setProps({
      event: createImageEvent({
        msgtype: 'm.image',
        body: 'second.png',
        url: 'mxc://server/second',
        info: {
          mimetype: 'image/png',
          w: 640,
          h: 360,
        },
      }),
    })

    secondThumb.resolve('blob:second-thumb')
    secondFull.resolve('blob:second-full')
    await flushPromises()
    firstThumb.resolve('blob:first-thumb')
    firstFull.resolve('blob:first-full')
    await flushPromises()

    expect(wrapper.get('img').attributes('src')).toBe('blob:second-thumb')
    await wrapper.get('[data-testid="image-message-frame"]').trigger('click')
    expect(openImageMock).toHaveBeenCalledWith('blob:second-full')

    wrapper.unmount()
  })
})
