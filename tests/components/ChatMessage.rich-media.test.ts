import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ChatMessage from '@/features/chat/components/ChatMessage.vue'

const mocks = vi.hoisted(() => ({
  fetchMediaBlobUrl: vi.fn((url: string, width?: number, height?: number) =>
    Promise.resolve(width && height ? `blob:thumb:${url}` : `blob:full:${url}`),
  ),
  openImage: vi.fn(),
}))

vi.mock('@matrix/media', () => ({
  fetchMediaBlobUrl: mocks.fetchMediaBlobUrl,
}))

vi.mock('@/features/chat/composables/useMediaViewer', () => ({
  useMediaViewer: () => ({
    openImage: mocks.openImage,
    openVideo: vi.fn(),
  }),
}))

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
}))

describe('chatMessage rich media', () => {
  it('renders mxc image embeds inside rich text and opens the full image', async () => {
    const event = {
      getId: () => '$rich-media-1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.text',
        body: 'Caption\n[pasted.png]',
        format: 'org.matrix.custom.html',
        formatted_body: '<p>Caption</p><p><img src="mxc://server/media" alt="pasted.png" data-width="640" data-height="360"></p>',
      }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      global: {
        stubs: {
          Avatar: true,
          LinkPreview: true,
          MessageActionBar: true,
          ReactionBar: true,
          AudioMessage: true,
          ContactCardMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    const richContent = wrapper.get('.rich-message-content')
    expect(richContent.classes()).toContain('[&_p:last-child]:mb-0')

    const initialImage = wrapper.get('img[alt="pasted.png"]')
    expect(initialImage.attributes('src')).not.toBe('mxc://server/media')
    expect(initialImage.attributes('data-rich-media-mxc-src')).toBe('mxc://server/media')
    expect(initialImage.attributes('style')).toContain('width: 300px')
    expect(initialImage.attributes('style')).toContain('height: 169px')

    await new Promise(resolve => setTimeout(resolve, 0))
    await vi.waitFor(() => {
      expect(wrapper.get('img[alt="pasted.png"]').attributes('src')).toBe('blob:thumb:mxc://server/media')
    }, { timeout: 500 })

    expect(mocks.fetchMediaBlobUrl).toHaveBeenCalledWith('mxc://server/media', 300, 300)
    expect(mocks.fetchMediaBlobUrl).toHaveBeenCalledWith('mxc://server/media')

    await wrapper.get('img[alt="pasted.png"]').trigger('click')

    expect(mocks.openImage).toHaveBeenCalledWith('blob:full:mxc://server/media')
  })
})
