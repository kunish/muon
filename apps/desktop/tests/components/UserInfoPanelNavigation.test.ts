import type { RoomSummary } from '@matrix/types'
import { findOrCreateDm } from '@matrix/rooms'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserInfoPanel from '@/features/chat/components/UserInfoPanel.vue'
import { chatStore, resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

const userInfoMocks = vi.hoisted(() => ({
  findOrCreateDm: vi.fn().mockResolvedValue('!dm:localhost'),
  restoreRoom: vi.fn(),
  routerPush: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: userInfoMocks.routerPush,
  }),
}))

vi.mock('@matrix/index', () => ({
  blockUser: vi.fn().mockResolvedValue(undefined),
  getUserPresenceInfo: vi.fn(() => ({ presence: 'online', statusMsg: '' })),
  isUserBlocked: vi.fn(() => false),
  unblockUser: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@matrix/rooms', () => ({
  findOrCreateDm: userInfoMocks.findOrCreateDm,
  getRoom: vi.fn(() => ({
    getJoinedMemberCount: () => 2,
    getMember: () => ({
      name: 'Alice',
      getMxcAvatarUrl: () => undefined,
    }),
  })),
}))

vi.mock('@/features/chat/composables/useConversations', () => ({
  useConversations: () => ({
    restoreRoom: userInfoMocks.restoreRoom,
  }),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

function mountPanel() {
  return mount(UserInfoPanel, {
    props: {
      room: null as RoomSummary | null,
      roomId: '!source:localhost',
      userId: '@alice:localhost',
      position: { x: 40, y: 48 },
    },
    global: {
      stubs: {
        Teleport: true,
        Transition: false,
      },
    },
  })
}

describe('userInfoPanel navigation', () => {
  beforeEach(() => {
    userInfoMocks.findOrCreateDm.mockResolvedValue('!dm:localhost')
    userInfoMocks.findOrCreateDm.mockClear()
    userInfoMocks.restoreRoom.mockClear()
    userInfoMocks.routerPush.mockClear()
    resetChatStore()
    setCurrentRoom(null)
  })

  it('opens a DM route when sending a message from the profile card', async () => {
    const wrapper = mountPanel()

    await wrapper.get('[data-testid="user-info-send-message"]').trigger('click')
    await flushPromises()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(userInfoMocks.restoreRoom).toHaveBeenCalledWith('!dm:localhost')
    expect(chatStore.state.currentRoomId).toBe('!dm:localhost')
    expect(userInfoMocks.routerPush).toHaveBeenCalledWith('/dm/!dm%3Alocalhost')
  })
})
