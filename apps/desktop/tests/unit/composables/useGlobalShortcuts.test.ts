import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { useGlobalShortcuts } from '@/app/composables/useGlobalShortcuts'
import { useGlobalUiStore } from '@/app/stores/globalUiStore'
import { useChatStore } from '@/features/chat/stores/chatStore'

const routerPush = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({
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
  it('opens global search with Cmd/Ctrl + K', () => {
    const wrapper = mountShortcutHost()
    const globalUi = useGlobalUiStore()

    const event = dispatchKey(document, 'k', { metaKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(globalUi.globalSearchOpen).toBe(true)

    wrapper.unmount()
  })

  it('opens settings with Cmd/Ctrl + comma and closes transient overlays', () => {
    const wrapper = mountShortcutHost()
    const globalUi = useGlobalUiStore()
    globalUi.openGlobalSearch()
    globalUi.openNewChat()

    const event = dispatchKey(document, ',', { ctrlKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(routerPush).toHaveBeenCalledWith('/settings')
    expect(globalUi.globalSearchOpen).toBe(false)
    expect(globalUi.newChatOpen).toBe(false)

    wrapper.unmount()
  })

  it('opens new chat with Cmd/Ctrl + N', () => {
    const wrapper = mountShortcutHost()
    const globalUi = useGlobalUiStore()

    const event = dispatchKey(document, 'n', { metaKey: true })

    expect(event.defaultPrevented).toBe(true)
    expect(globalUi.newChatOpen).toBe(true)

    wrapper.unmount()
  })

  it('uses Escape to close the topmost transient UI', () => {
    const wrapper = mountShortcutHost()
    const globalUi = useGlobalUiStore()
    const chatStore = useChatStore()

    globalUi.openNewChat()
    dispatchKey(document, 'Escape')
    expect(globalUi.newChatOpen).toBe(false)

    chatStore.toggleSidePanel('search')
    dispatchKey(document, 'Escape')
    expect(chatStore.activeSidePanel).toBe(null)

    wrapper.unmount()
  })

  it('does not steal Escape from editable fields unless a global overlay is open', () => {
    const wrapper = mountShortcutHost()
    const globalUi = useGlobalUiStore()
    const chatStore = useChatStore()
    const input = document.createElement('input')
    document.body.append(input)

    chatStore.toggleSidePanel('search')
    dispatchKey(input, 'Escape')
    expect(chatStore.activeSidePanel).toBe('search')

    globalUi.openGlobalSearch()
    dispatchKey(input, 'Escape')
    expect(globalUi.globalSearchOpen).toBe(false)

    input.remove()
    wrapper.unmount()
  })
})
