import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useGlobalShortcuts } from '@/app/composables/useGlobalShortcuts'
import { globalUiStore, openGlobalSearch, openNewChat, resetGlobalUiStore } from '@/app/stores/globalUiStore'
import { useChatStore } from '@/features/chat/stores/chatStore'

const routerPush = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  fullPath: '/contacts',
  path: '/contacts',
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push: routerPush,
  }),
}))

function mountShortcutHost() {
  return mount(
    defineComponent({
      setup() {
        useGlobalShortcuts()
        return () => null
      },
    }),
  )
}

function dispatchKey(target: EventTarget, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  target.dispatchEvent(event)
  return event
}

describe('useGlobalShortcuts', () => {
  beforeEach(() => {
    route.fullPath = '/contacts'
    route.path = '/contacts'
    routerPush.mockReset()
    resetGlobalUiStore()
  })

  it('opens global search with Cmd/Ctrl + K', () => {
    const wrapper = mountShortcutHost()

    const event = dispatchKey(document, 'k', { metaKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(globalUiStore.state.globalSearchOpen).toBe(true)

    wrapper.unmount()
  })

  it('opens settings with Cmd/Ctrl + comma and closes transient overlays', () => {
    const wrapper = mountShortcutHost()
    openGlobalSearch()
    openNewChat()

    const event = dispatchKey(document, ',', { ctrlKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(routerPush).toHaveBeenCalledWith('/settings')
    expect(globalUiStore.state.globalSearchOpen).toBe(false)
    expect(globalUiStore.state.newChatOpen).toBe(false)

    wrapper.unmount()
  })

  it('returns to the last concrete message route from Cmd/Ctrl + 1', () => {
    route.fullPath = '/dm/!alice%3Alocalhost'
    route.path = '/dm/!alice:localhost'

    const wrapper = mountShortcutHost()
    route.fullPath = '/calendar'
    route.path = '/calendar'

    const event = dispatchKey(document, '1', { metaKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(routerPush).toHaveBeenCalledWith('/dm/!alice%3Alocalhost')

    wrapper.unmount()
  })

  it('opens new chat with Cmd/Ctrl + N', () => {
    const wrapper = mountShortcutHost()

    const event = dispatchKey(document, 'n', { metaKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(globalUiStore.state.newChatOpen).toBe(true)

    wrapper.unmount()
  })

  it('uses Escape to close the topmost transient UI', () => {
    const wrapper = mountShortcutHost()
    const chatStore = useChatStore()

    openNewChat()
    dispatchKey(document, 'Escape')
    expect(globalUiStore.state.newChatOpen).toBe(false)

    chatStore.toggleSidePanel('search')
    dispatchKey(document, 'Escape')
    expect(chatStore.activeSidePanel).toBe(null)

    wrapper.unmount()
  })

  it('does not steal Escape from editable fields unless a global overlay is open', () => {
    const wrapper = mountShortcutHost()
    const chatStore = useChatStore()
    const input = document.createElement('input')
    document.body.append(input)

    chatStore.toggleSidePanel('search')
    dispatchKey(input, 'Escape')
    expect(chatStore.activeSidePanel).toBe('search')

    openGlobalSearch()
    dispatchKey(input, 'Escape')
    expect(globalUiStore.state.globalSearchOpen).toBe(false)

    input.remove()
    wrapper.unmount()
  })
})
