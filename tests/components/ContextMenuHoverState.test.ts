import type { ChannelInfo } from '@/matrix/spaces'
import type { RoomSummary } from '@/matrix/types'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { useServerStore } from '@/features/server/stores/serverStore'

enableAutoUnmount(afterEach)

afterEach(() => {
  document.body.innerHTML = ''
})

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('@matrix/index', () => ({
  getReactions: vi.fn().mockReturnValue([]),
  getThreadReplies: vi.fn().mockReturnValue([]),
  redactMessage: vi.fn(),
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

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!dm:localhost',
    name: 'Alice',
    unreadCount: 0,
    isDirect: true,
    isEncrypted: false,
    members: ['@alice:localhost'],
    isPinned: false,
    isMuted: false,
    highlightCount: 0,
    memberCount: 2,
    ...overrides,
  }
}

function createChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    roomId: '!channel:localhost',
    name: 'general',
    isVoice: false,
    categoryId: null,
    unreadCount: 0,
    highlightCount: 0,
    memberCount: 3,
    ...overrides,
  }
}

describe('context menu hover state', () => {
  it('keeps a chat message visually hovered while its context menu is open', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      attachTo: document.body,
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

    expect(wrapper.classes()).toContain('bg-accent/30')
  })

  it('hides the chat message action bar while its context menu is open', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
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
          MessageActionBar: { template: '<div data-testid="message-action-bar-stub" />' },
          ReactionBar: true,
          AudioMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    await wrapper.trigger('mouseenter')
    await nextTick()
    expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).not.toBeNull()

    await wrapper.trigger('contextmenu')
    await nextTick()

    expect(wrapper.classes()).toContain('bg-accent/30')
    expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).toBeNull()
  })

  it('keeps the chat message context menu away from the viewport edge', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const originalInnerHeight = window.innerHeight
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 240 })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })

    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const el = this as HTMLElement
      if (el.classList.contains('z-[220]')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 180,
          bottom: 152,
          width: 180,
          height: 152,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect
    })

    const wrapper = mount(ChatMessage, {
      props: {
        event: event as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      attachTo: document.body,
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

    try {
      await wrapper.trigger('contextmenu', { clientX: 310, clientY: 230 })
      await nextTick()
      await nextTick()

      const menu = Array.from(document.body.querySelectorAll<HTMLElement>('div.fixed'))
        .find(el => el.textContent?.includes('回复')) ?? null

      expect(menu).not.toBeNull()
      expect(menu?.style.left).toBe('124px')
      expect(menu?.style.top).toBe('72px')
    }
    finally {
      rectSpy.mockRestore()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('hides action bars from adjacent messages while a context menu is open', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const firstEvent = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'First' }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }
    const secondEvent = {
      getId: () => '$event2',
      getType: () => 'm.room.message',
      getSender: () => '@bob:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Second' }),
      getTs: () => 1767225660000,
      isRedacted: () => false,
    }

    const stubs = {
      Avatar: true,
      LinkPreview: true,
      MessageActionBar: { template: '<div data-testid="message-action-bar-stub" />' },
      ReactionBar: true,
      AudioMessage: true,
      FileMessage: true,
      ImageMessage: true,
      VideoMessage: true,
    }

    const firstWrapper = mount(ChatMessage, {
      props: {
        event: firstEvent as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      global: { stubs },
    })
    const secondWrapper = mount(ChatMessage, {
      props: {
        event: secondEvent as any,
        isFirst: false,
        roomId: '!room:localhost',
      },
      global: { stubs },
    })

    await secondWrapper.trigger('mouseenter')
    await nextTick()
    expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).not.toBeNull()

    await firstWrapper.trigger('contextmenu')
    await nextTick()

    expect(firstWrapper.classes()).toContain('bg-accent/30')
    expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).toBeNull()
  })

  it('renders the chat message action bar as a fixed body-level overlay', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
      getTs: () => 1767225600000,
      isRedacted: () => false,
    }

    const originalInnerHeight = window.innerHeight
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 640 })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })

    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const el = this as HTMLElement
      if (el.getAttribute('data-testid') === 'chat-message-row') {
        return {
          x: 200,
          y: 120,
          left: 200,
          top: 120,
          right: 520,
          bottom: 160,
          width: 320,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect
      }
      if (el.matches('[data-testid="chat-message-action-bar"]')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 192,
          bottom: 40,
          width: 192,
          height: 40,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect
    })

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
          MessageActionBar: { template: '<div data-testid="message-action-bar-stub" />' },
          ReactionBar: true,
          AudioMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    try {
      await wrapper.trigger('mouseenter')
      await nextTick()

      const actionBarHost = document.body.querySelector('[data-testid="chat-message-action-bar"]') as HTMLElement | null
      expect(actionBarHost).not.toBeNull()
      expect(actionBarHost?.classList.contains('fixed')).toBe(true)
      expect(actionBarHost?.classList.contains('z-[190]')).toBe(true)
      expect(actionBarHost?.style.left).not.toBe('')
      expect(actionBarHost?.style.top).not.toBe('')
    }
    finally {
      rectSpy.mockRestore()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('keeps the chat message action bar mounted while its menu is open', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
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
          MessageActionBar: {
            emits: ['menuOpenChange'],
            template: '<button data-testid="message-action-bar-stub" @click="$emit(\'menuOpenChange\', true)" />',
          },
          ReactionBar: true,
          AudioMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    await wrapper.trigger('mouseenter')
    await nextTick()
    const actionBar = document.body.querySelector('[data-testid="message-action-bar-stub"]') as HTMLElement | null
    expect(actionBar).not.toBeNull()
    actionBar?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    await wrapper.trigger('mouseleave')

    expect(document.body.querySelector('[data-testid="message-action-bar-stub"]')).not.toBeNull()
    wrapper.unmount()
    document.body.innerHTML = ''
  })

  it('hides the chat message action bar after an outside pointer down', async () => {
    const ChatMessage = (
      await import('@/features/chat/components/ChatMessage.vue')
    ).default

    const event = {
      getId: () => '$event1',
      getType: () => 'm.room.message',
      getSender: () => '@alice:localhost',
      getContent: () => ({ msgtype: 'm.text', body: 'Hello' }),
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
          MessageActionBar: { template: '<div data-testid="message-action-bar-stub" />' },
          ReactionBar: true,
          AudioMessage: true,
          FileMessage: true,
          ImageMessage: true,
          VideoMessage: true,
        },
      },
    })

    const outsideTarget = document.createElement('button')
    document.body.appendChild(outsideTarget)

    try {
      await wrapper.trigger('mouseenter')
      await nextTick()
      expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).not.toBeNull()

      outsideTarget.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
      await nextTick()

      expect(document.body.querySelector('[data-testid="chat-message-action-bar"]')).toBeNull()
    }
    finally {
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('keeps a conversation row visually hovered while its context menu is open', async () => {
    const ConversationItem = (
      await import('@/features/chat/components/ConversationItem.vue')
    ).default

    const wrapper = mount(ConversationItem, {
      props: {
        room: createRoom(),
        active: false,
        contextMenuOpen: true,
      },
    })

    expect(wrapper.classes()).toContain('bg-accent')
    expect(wrapper.classes()).not.toContain('shadow-[0_1px_4px_rgba(0,0,0,0.02)]')
  })

  it('keeps the conversation context menu away from the viewport edge', async () => {
    const ConversationContextMenu = (
      await import('@/features/chat/components/ConversationContextMenu.vue')
    ).default
    const { useChatStore } = await import('@/features/chat/stores/chatStore')
    const store = useChatStore()

    const originalInnerHeight = window.innerHeight
    const originalInnerWidth = window.innerWidth
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 240 })
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 })

    const rectSpy = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const el = this as HTMLElement
      if (el.classList.contains('ctx-menu')) {
        return {
          x: 0,
          y: 0,
          left: 0,
          top: 0,
          right: 180,
          bottom: 176,
          width: 180,
          height: 176,
          toJSON: () => ({}),
        } as DOMRect
      }
      return {
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      } as DOMRect
    })

    store.openContextMenu('!dm:localhost', 310, 230)
    const wrapper = mount(ConversationContextMenu, {
      attachTo: document.body,
    })

    try {
      await nextTick()
      await nextTick()

      const menu = document.body.querySelector<HTMLElement>('.ctx-menu')

      expect(menu).not.toBeNull()
      expect(menu?.style.left).toBe('124px')
      expect(menu?.style.top).toBe('48px')
    }
    finally {
      rectSpy.mockRestore()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalInnerHeight })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalInnerWidth })
      store.closeContextMenu()
      wrapper.unmount()
      document.body.innerHTML = ''
    }
  })

  it('keeps a text channel row visually hovered while its context menu is open', async () => {
    const TextChannelItem = (
      await import('@/features/server/components/TextChannelItem.vue')
    ).default
    const serverStore = useServerStore()
    serverStore.currentChannelId = '!other:localhost'

    const wrapper = mount(TextChannelItem, {
      props: {
        channel: createChannel(),
        contextMenuOpen: true,
      },
    })

    const button = wrapper.get('button')
    expect(button.classes()).toContain('bg-sidebar-accent')
    expect(button.classes()).toContain('text-foreground')
  })
})
