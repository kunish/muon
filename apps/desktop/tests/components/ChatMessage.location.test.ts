import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

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
  RawMessageDialog: true,
  MessageContextMenu: true,
}

describe('chatMessage location rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders an m.location message as a map location card', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default

    const event = {
      getId: () => '$loc1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.location',
        body: '深圳市南山区',
        geo_uri: 'geo:22.5431,114.0579',
      }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: { event: event as any, isFirst: false, roomId: '!room:localhost' },
      global: { stubs: STUBS },
    })

    const link = wrapper.get('a[href*="openstreetmap.org"]')
    expect(link.attributes('href')).toContain('mlat=22.5431')
    expect(link.attributes('href')).toContain('mlon=114.0579')
    expect(link.text()).toContain('深圳市南山区')
  })

  it('does not fall back to plain text for location messages', async () => {
    const ChatMessage = (await import('@/features/chat/components/ChatMessage.vue')).default

    const event = {
      getId: () => '$loc2',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({
        msgtype: 'm.location',
        body: '北京市朝阳区',
        geo_uri: 'geo:39.9219,116.4438',
      }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: { event: event as any, isFirst: false, roomId: '!room:localhost' },
      global: { stubs: STUBS },
    })

    // The plain-text fallback paragraph carries this class; a location card must not use it.
    expect(wrapper.find('p.message-selectable-text').exists()).toBe(false)
    expect(wrapper.find('a[href*="openstreetmap.org"]').exists()).toBe(true)
  })
})
