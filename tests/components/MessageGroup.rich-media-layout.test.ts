import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessageGroup from '@/features/chat/components/MessageGroup.vue'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getRoom: vi.fn(() => ({
      getMember: vi.fn(() => ({
        name: 'Alice',
        getMxcAvatarUrl: vi.fn(),
      })),
    })),
    getUserId: vi.fn(() => '@me:localhost'),
  })),
}))

vi.mock('@matrix/index', () => ({
  isSystemEvent: vi.fn(() => false),
}))

function createTextEvent(content: Record<string, unknown>) {
  return {
    getId: () => '$rich-media-layout',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => content,
    getTs: () => 1767225600000,
    isRedacted: () => false,
  } as any
}

function mountGroup(event: any) {
  return mount(MessageGroup, {
    props: {
      events: [event],
      roomId: '!room:localhost',
    },
    global: {
      plugins: [createPinia()],
      stubs: {
        ChatMessage: {
          props: ['event', 'isFirst', 'roomId', 'hideAvatarColumn'],
          template: '<div data-testid="chat-message" />',
        },
        MessageGroupAvatar: {
          template: '<button data-testid="group-avatar" />',
        },
        NewMessageSeparator: true,
        SystemMessage: true,
        TimeStamp: true,
      },
    },
  })
}

describe('message group rich media layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('anchors the avatar at the start of a rich image message group', () => {
    const wrapper = mountGroup(createTextEvent({
      msgtype: 'm.text',
      body: '1234\n[image.png]',
      format: 'org.matrix.custom.html',
      formatted_body: '<p>1234</p><p><img src="mxc://server/media" alt="image.png" data-width="1440" data-height="900"></p>',
    }))

    const avatarAnchor = wrapper.get('[data-testid="group-avatar"]').element.parentElement as HTMLElement
    const avatarLane = avatarAnchor.parentElement as HTMLElement
    expect(avatarAnchor.className).not.toContain('sticky')
    expect(avatarAnchor.className).not.toContain('bottom-1')
    expect(avatarAnchor.className).toContain('self-end')
    expect(avatarLane.className).toContain('justify-start')
    expect(avatarLane.className).toContain('self-start')
    expect(avatarLane.className).not.toContain('justify-end')
  })

  it('keeps the sticky avatar behavior for plain text groups', () => {
    const wrapper = mountGroup(createTextEvent({
      msgtype: 'm.text',
      body: 'plain text',
    }))

    const avatarAnchor = wrapper.get('[data-testid="group-avatar"]').element.parentElement as HTMLElement
    const avatarLane = avatarAnchor.parentElement as HTMLElement
    expect(avatarAnchor.className).toContain('sticky')
    expect(avatarAnchor.className).toContain('bottom-1')
    expect(avatarLane.className).toContain('justify-end')
    expect(avatarLane.className).toContain('self-stretch')
  })
})
