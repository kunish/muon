import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCallStore } from '@/features/calls/stores/callStore'
import ChatHeader from '@/features/chat/components/ChatHeader.vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const mockedRoom = vi.hoisted(() => ({
  roomId: '!dm:localhost',
  name: 'Direct Chat',
  hasEncryptionStateEvent: vi.fn(() => false),
}))
const direct = vi.hoisted(() => ({ value: true }))

vi.mock('@matrix/index', () => ({
  getRoom: () => mockedRoom,
  matrixEvents: { on: vi.fn(), off: vi.fn() },
  sendCallInvite: vi.fn(),
  sendCallAnswer: vi.fn(),
  sendCallHangup: vi.fn(),
  CALL_INVITE_EVENT: 'im.muon.call.invite',
  CALL_ANSWER_EVENT: 'im.muon.call.answer',
  CALL_HANGUP_EVENT: 'im.muon.call.hangup',
}))

vi.mock('@matrix/rooms', () => ({ getRoomTopic: () => '' }))

vi.mock('@matrix/roomUtils', () => ({
  isDirectRoom: () => direct.value,
  getDirectRoomPeer: () => ({ userId: '@bob:localhost', displayName: 'Bob' }),
}))

describe('chat header call entry', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    direct.value = true
    useChatStore().setCurrentRoom(mockedRoom.roomId)
  })

  it('starts an audio call with the direct peer', async () => {
    const startCall = vi.spyOn(useCallStore(), 'startCall').mockResolvedValue()
    const wrapper = mount(ChatHeader)

    await wrapper.get('[data-testid="chat-header-call-audio"]').trigger('click')

    expect(startCall).toHaveBeenCalledWith('!dm:localhost', '@bob:localhost', 'Bob', 'audio')
  })

  it('starts a video call with the direct peer', async () => {
    const startCall = vi.spyOn(useCallStore(), 'startCall').mockResolvedValue()
    const wrapper = mount(ChatHeader)

    await wrapper.get('[data-testid="chat-header-call-video"]').trigger('click')

    expect(startCall).toHaveBeenCalledWith('!dm:localhost', '@bob:localhost', 'Bob', 'video')
  })

  it('starts a room-wide call from a group chat', async () => {
    direct.value = false
    const startCall = vi.spyOn(useCallStore(), 'startCall').mockResolvedValue()
    const wrapper = mount(ChatHeader)

    // call entry is available in group chats too
    expect(wrapper.find('[data-testid="chat-header-call-video"]').exists()).toBe(true)
    await wrapper.get('[data-testid="chat-header-call-video"]').trigger('click')

    expect(startCall).toHaveBeenCalledWith('!dm:localhost', '!dm:localhost', 'Direct Chat', 'video')
  })
})
