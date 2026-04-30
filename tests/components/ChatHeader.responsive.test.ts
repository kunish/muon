import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatHeader from '@/features/chat/components/ChatHeader.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const mockedRoom = vi.hoisted(() => ({
  roomId: '!responsive:localhost',
  name: 'localhost Admin Room With A Very Long Display Name',
  hasEncryptionStateEvent: vi.fn(() => false),
}))

vi.mock('@matrix/index', () => ({
  getRoom: (roomId: string) => roomId === mockedRoom.roomId ? mockedRoom : null,
}))

vi.mock('@matrix/rooms', () => ({
  getRoomTopic: () => 'A very long room topic that should not force the header wider',
}))

vi.mock('@matrix/roomUtils', () => ({
  isDirectRoom: () => true,
}))

describe('chatHeader responsive layout', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useChatStore().setCurrentRoom(mockedRoom.roomId)
  })

  it('lets the room title shrink before compact actions overflow it', () => {
    const wrapper = mount(ChatHeader)

    expect(wrapper.get('[data-testid="chat-header-title"]').classes()).toEqual(
      expect.arrayContaining(['min-w-0', 'overflow-hidden']),
    )

    const roomName = wrapper.get('[data-testid="chat-header-room-name"]')
    expect(roomName.classes()).toEqual(expect.arrayContaining(['min-w-0', 'truncate']))
    expect(roomName.classes()).not.toContain('shrink-0')

    for (const id of ['threads', 'settings', 'pinned', 'members']) {
      expect(wrapper.get(`[data-testid="chat-header-action-${id}"]`).classes()).toEqual(
        expect.arrayContaining(['hidden', 'sm:flex']),
      )
    }

    const searchControl = wrapper.get('[data-testid="chat-header-search-control"]')
    expect(searchControl.classes()).toEqual(expect.arrayContaining(['size-8', 'sm:w-[140px]']))
    expect(searchControl.get('span').classes()).toEqual(expect.arrayContaining(['hidden', 'sm:inline']))
  })

  it('keeps compact-only actions reachable from the more menu', async () => {
    const store = useChatStore()
    const wrapper = mount(ChatHeader)

    await wrapper.get('[data-testid="chat-header-more-button"]').trigger('click')

    const membersAction = wrapper.get('[data-testid="chat-header-menu-members"]')
    expect(membersAction.classes()).toContain('sm:hidden')

    await membersAction.trigger('click')
    expect(store.activeSidePanel).toBe('members')
  })

  it('uses compact header controls while a secondary panel constrains the chat area', async () => {
    const store = useChatStore()
    store.toggleSidePanel('search')

    const wrapper = mount(ChatHeader)

    expect(wrapper.get('[data-testid="chat-header-action-members"]').classes()).toContain('hidden')
    expect(wrapper.get('[data-testid="chat-header-action-members"]').classes()).not.toContain('sm:flex')

    const searchControl = wrapper.get('[data-testid="chat-header-search-control"]')
    expect(searchControl.classes()).toContain('size-8')
    expect(searchControl.classes()).not.toContain('sm:w-[140px]')
    expect(searchControl.get('span').classes()).not.toContain('sm:inline')

    await wrapper.get('[data-testid="chat-header-more-button"]').trigger('click')
    expect(wrapper.get('[data-testid="chat-header-menu-members"]').classes()).not.toContain('sm:hidden')
  })

  it('renders a promoted room title while the Matrix room is still unavailable', () => {
    const store = useChatStore()
    store.setCurrentRoom('!pending-group:localhost', {
      sidebarPlacement: 'promote',
      sidebarPreview: {
        name: '设计评审',
        isDirect: false,
      },
    })
    store.setCurrentRoomFromRoute('!pending-group:localhost')

    const wrapper = mount(ChatHeader)

    expect(wrapper.get('[data-testid="chat-header-room-name"]').text()).toBe('设计评审')
  })
})
