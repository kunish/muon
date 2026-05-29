import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({ ask: vi.fn() }))
vi.mock('vue-sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }))

const STUBS = {
  Avatar: true,
  LinkPreview: true,
  MessageActionBar: true,
  ReactionBar: true,
  AudioMessage: true,
  ContactCardMessage: true,
  FileMessage: true,
  ImageMessage: true,
  VideoMessage: true,
  LocationMessage: true,
  RawMessageDialog: true,
  MessageContextMenu: true,
  // 用可识别的桩替代真实 AnimatedEmoji，避免在测试里加载 lottie-web
  AnimatedEmoji: { template: '<div data-testid="animated-emoji" />' },
}

function emojiEvent(body: string) {
  return {
    getId: () => '$emoji-1',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  }
}

describe('chatMessage animated emoji', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an emoji-only message with AnimatedEmoji instead of plain text', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
    const wrapper = mount(ChatMessage, {
      props: { event: emojiEvent('👍') as any, isFirst: false, roomId: '!room:localhost' },
      global: { stubs: STUBS },
    })

    expect(wrapper.find('[data-testid="animated-emoji"]').exists()).toBe(true)
  })

  it('keeps rendering normal text without AnimatedEmoji', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default
    const wrapper = mount(ChatMessage, {
      props: { event: emojiEvent('hello world') as any, isFirst: false, roomId: '!room:localhost' },
      global: { stubs: STUBS },
    })

    expect(wrapper.find('[data-testid="animated-emoji"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('hello world')
  })
})
