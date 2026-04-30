import type { SpaceMember } from '@/matrix/spaces'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  leaveRoom: vi.fn().mockResolvedValue(undefined),
  redactMessage: vi.fn(),
  toggleRoomMute: vi.fn().mockResolvedValue(undefined),
  toggleRoomPin: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    archiveDm: vi.fn(),
    refresh: vi.fn(),
    removeRoom: vi.fn(),
  }),
}))

function createMessageEvent() {
  return {
    getId: () => '$event1',
    getType: () => 'm.room.message',
    getSender: () => '@alice:localhost',
    getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
    getTs: () => 1767225600000,
    isRedacted: () => false,
  }
}

function createMember(overrides: Partial<SpaceMember> = {}): SpaceMember {
  return {
    userId: '@alice:localhost',
    displayName: 'Alice',
    powerLevel: 0,
    membership: 'join',
    ...overrides,
  }
}

function dispatchBackgroundWheel(): WheelEvent {
  const background = document.createElement('div')
  document.body.appendChild(background)
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    deltaY: 120,
  })

  background.dispatchEvent(event)
  background.remove()
  return event
}

describe('context menu scroll lock', () => {
  it('prevents the chat timeline from scrolling while a message context menu is open', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const wrapper = mount(ChatMessage, {
      props: {
        event: createMessageEvent() as any,
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
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    await wrapper.trigger('contextmenu')
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(true)

    wrapper.unmount()
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(false)
  })

  it('prevents the conversation list from scrolling while its context menu is open', async () => {
    const ConversationContextMenu = (
      await import('@/features/chat/components/ConversationContextMenu.vue')
    ).default
    const store = useChatStore()

    store.openContextMenu('!dm:localhost', 32, 48)
    const wrapper = mount(ConversationContextMenu)
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(true)

    store.closeContextMenu()
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(false)
    wrapper.unmount()
  })

  it('prevents the member panel from scrolling while its context menu is open', async () => {
    const MemberContextMenu = (
      await import('@/features/server/components/MemberContextMenu.vue')
    ).default

    const wrapper = mount(MemberContextMenu, {
      props: {
        member: createMember(),
        position: { x: 80, y: 96 },
        serverId: '!server:localhost',
      },
    })
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(true)

    await wrapper.setProps({ member: null })
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(false)
  })

  it('prevents underlying scroll for shared Reka context menus', async () => {
    const ContextMenu = (
      await import('@/shared/components/ui/context-menu/ContextMenu.vue')
    ).default

    const wrapper = mount(ContextMenu, {
      props: { open: true },
      slots: {
        default: '<button>Open</button>',
      },
    })
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(true)

    await wrapper.setProps({ open: false })
    await nextTick()

    expect(dispatchBackgroundWheel().defaultPrevented).toBe(false)
  })
})
