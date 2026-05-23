import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

const { fetchMediaBlobUrlMock } = vi.hoisted(() => ({
  fetchMediaBlobUrlMock: vi.fn(),
}))

vi.mock('@matrix/index', () => ({
  fetchMediaBlobUrl: fetchMediaBlobUrlMock,
}))

function createVideoEvent(content: Record<string, unknown>): MatrixEvent {
  return {
    getContent: () => content,
  } as unknown as MatrixEvent
}

describe('video message layout', () => {
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
})
