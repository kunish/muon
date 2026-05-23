import type { MatrixEvent } from 'matrix-js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { fetchMediaBlobUrlMock } = vi.hoisted(() => ({
  fetchMediaBlobUrlMock: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  fetchMediaBlobUrl: fetchMediaBlobUrlMock,
}))

function createImageEvent(content: Record<string, unknown>): MatrixEvent {
  return {
    getContent: () => content,
  } as unknown as MatrixEvent
}

describe('image message layout', () => {
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

    const frame = wrapper.get('.cursor-pointer')
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
})
