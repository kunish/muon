import type { SpaceMember } from '@/matrix/spaces'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useChatStore } from '@/features/chat/stores/chatStore'
import MemberContextMenu from '@/features/server/components/MemberContextMenu.vue'
import UserPopover from '@/features/server/components/UserPopover.vue'
import { findOrCreateDm } from '@/matrix/rooms'

const dmNavigationMocks = vi.hoisted(() => ({
  findOrCreateDm: vi.fn().mockResolvedValue('!dm:localhost'),
  restoreRoom: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: dmNavigationMocks.routerPush,
  }),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    restoreRoom: dmNavigationMocks.restoreRoom,
  }),
}))

vi.mock('@/electron/dialog', () => ({
  ask: vi.fn(),
}))

vi.mock('@/matrix/rooms', () => ({
  findOrCreateDm: dmNavigationMocks.findOrCreateDm,
}))

function createMember(): SpaceMember {
  return {
    userId: '@alice:localhost',
    displayName: 'Alice',
    avatarUrl: 'mxc://localhost/alice',
    powerLevel: 0,
    membership: 'join',
  }
}

describe('member dm navigation', () => {
  beforeEach(() => {
    dmNavigationMocks.findOrCreateDm.mockResolvedValue('!dm:localhost')
    dmNavigationMocks.findOrCreateDm.mockClear()
    dmNavigationMocks.restoreRoom.mockClear()
    dmNavigationMocks.routerPush.mockClear()
    useChatStore().setCurrentRoom(null)
  })

  it('opens the selected member from the member context menu in the DM workspace', async () => {
    const wrapper = mount(MemberContextMenu, {
      props: {
        member: createMember(),
        position: { x: 40, y: 48 },
        serverId: '!server:localhost',
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    })

    await wrapper.get('[data-testid="member-context-message"]').trigger('click')
    await flushPromises()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(dmNavigationMocks.restoreRoom).toHaveBeenCalledWith('!dm:localhost')
    expect(useChatStore().currentRoomId).toBe('!dm:localhost')
    expect(dmNavigationMocks.routerPush).toHaveBeenCalledWith('/dm/!dm%3Alocalhost')
  })

  it('opens the selected member from the user popover in the DM workspace', async () => {
    const wrapper = mount(UserPopover, {
      props: {
        member: createMember(),
        position: { x: 40, y: 48 },
      },
      global: {
        stubs: {
          Avatar: true,
          Teleport: true,
          Transition: false,
        },
      },
    })

    await wrapper.get('[data-testid="user-popover-message"]').trigger('click')
    await flushPromises()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(dmNavigationMocks.restoreRoom).toHaveBeenCalledWith('!dm:localhost')
    expect(useChatStore().currentRoomId).toBe('!dm:localhost')
    expect(dmNavigationMocks.routerPush).toHaveBeenCalledWith('/dm/!dm%3Alocalhost')
  })

  it('uses Chinese copy in the user popover actions and metadata', () => {
    const wrapper = mount(UserPopover, {
      props: {
        member: createMember(),
        position: { x: 40, y: 48 },
      },
      global: {
        stubs: {
          Avatar: true,
          Teleport: true,
          Transition: false,
        },
      },
    })

    expect(wrapper.text()).toContain('角色')
    expect(wrapper.text()).toContain('成员')
    expect(wrapper.text()).toContain('发消息')
    expect(wrapper.text()).toContain('离线')
    expect(wrapper.text()).not.toContain('Roles')
    expect(wrapper.text()).not.toContain('Message')
    expect(wrapper.text()).not.toContain('Offline')
  })
})
