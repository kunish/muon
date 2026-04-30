import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { fetchMock, openUrlMock, toastErrorMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  openUrlMock: vi.fn(),
  toastErrorMock: vi.fn(),
}))

vi.mock('@/electron/http', () => ({
  fetch: fetchMock,
}))

vi.mock('@/electron/opener', () => ({
  openUrl: openUrlMock,
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastErrorMock,
  },
}))

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

describe('chatMessage link detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(globalThis as any).__ogCache = new Map()
    ;(globalThis as any).__ogInflight = new Map()
  })

  it('renders plain text URLs as clickable links when no formatted body exists', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$link1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.text',
        body: 'https://www.baidu.com',
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

    const link = wrapper.get('a[href="https://www.baidu.com"]')
    expect(link.text()).toBe('https://www.baidu.com')
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('keeps a fallback link card when metadata cannot be fetched', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network unavailable'))
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$link2',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.text',
        body: 'https://www.baidu.com',
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

    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('https://www.baidu.com/', expect.any(Object))
    expect(wrapper.find('.link-card').exists()).toBe(true)
    expect(wrapper.text()).toContain('www.baidu.com')
    expect(wrapper.text()).toContain('https://www.baidu.com')
  })
})
