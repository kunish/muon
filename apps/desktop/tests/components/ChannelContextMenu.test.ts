import type { ChannelInfo } from '@/matrix/spaces'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import ChannelContextMenu from '@/features/server/components/ChannelContextMenu.vue'
import { useServerStore } from '@/features/server/stores/serverStore'

const clipboardMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
    success: toastMocks.success,
  },
}))

vi.mock('@muon/ui/context-menu', () => ({
  ContextMenu: defineComponent({
    name: 'ContextMenu',
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  }),
  ContextMenuContent: defineComponent({
    name: 'ContextMenuContent',
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  }),
  ContextMenuItem: defineComponent({
    name: 'ContextMenuItem',
    emits: ['select'],
    setup(_, { emit, slots }) {
      return () => h('button', { onClick: () => emit('select') }, slots.default?.())
    },
  }),
  ContextMenuSeparator: defineComponent({
    name: 'ContextMenuSeparator',
    setup() {
      return () => h('hr')
    },
  }),
  ContextMenuTrigger: defineComponent({
    name: 'ContextMenuTrigger',
    setup(_, { slots }) {
      return () => h('div', slots.default?.())
    },
  }),
}))

function createChannel(overrides: Partial<ChannelInfo> = {}): ChannelInfo {
  return {
    roomId: '!general:localhost',
    name: 'general',
    isVoice: false,
    categoryId: null,
    unreadCount: 0,
    highlightCount: 0,
    memberCount: 3,
    ...overrides,
  }
}

function mountMenu(channel = createChannel()) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useServerStore().currentServerId = '!server:localhost'

  return mount(ChannelContextMenu, {
    props: { channel },
    global: {
      plugins: [pinia],
    },
    slots: {
      default: '<span>general</span>',
    },
  })
}

describe('channelContextMenu', () => {
  beforeEach(() => {
    clipboardMocks.writeText.mockReset()
    clipboardMocks.writeText.mockResolvedValue(undefined)
    toastMocks.error.mockReset()
    toastMocks.success.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardMocks.writeText,
      },
    })
  })

  it('confirms when the channel link is copied', async () => {
    const wrapper = mountMenu()

    await wrapper.get('button:last-of-type').trigger('click')
    await flushPromises()

    expect(clipboardMocks.writeText).toHaveBeenCalledWith(expect.stringContaining('/server/!server%3Alocalhost/channel/!general%3Alocalhost'))
    expect(toastMocks.success).toHaveBeenCalledWith('频道链接已复制')
    expect(wrapper.emitted('copyLink')).toEqual([['!general:localhost']])
  })

  it('shows a visible error when the channel link cannot be copied', async () => {
    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mountMenu()

    await wrapper.get('button:last-of-type').trigger('click')
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('无法复制频道链接')
    expect(wrapper.emitted('copyLink')).toBeUndefined()
  })
})
