import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatSettingsPanel from '@/features/chat/components/ChatSettingsPanel.vue'
import { isMuted, isPinned, resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

const clipboardMocks = vi.hoisted(() => ({
  writeText: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
}))

const toggleRoomMute = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const toggleRoomPin = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const room = vi.hoisted(() => ({
  getJoinedMemberCount: () => 2,
  getJoinedMembers: () => [],
  getMxcAvatarUrl: () => undefined,
  getMember: () => null,
  hasEncryptionStateEvent: () => false,
  name: 'Project Room',
}))

vi.mock('@matrix/client', () => ({
  getClient: () => ({
    getRoom: () => room,
  }),
}))

vi.mock('@matrix/rooms', () => ({
  getRoomTopic: vi.fn(() => ''),
  leaveRoom: vi.fn(),
  setRoomTopic: vi.fn(),
  toggleRoomMute,
  toggleRoomPin,
}))

vi.mock('@matrix/roomUtils', () => ({
  isDirectRoom: vi.fn(() => false),
}))

vi.mock('@/desktop/dialog', () => ({
  ask: vi.fn(),
}))

vi.mock('vue-sonner', () => ({
  toast: {
    error: toastMocks.error,
  },
}))

const SwitchStub = {
  props: {
    modelValue: Boolean,
  },
  emits: ['update:modelValue'],
  template: `
    <button
      data-testid="switch-stub"
      type="button"
      :data-checked="modelValue"
      @click="$emit('update:modelValue', !modelValue)"
    />
  `,
}

function mountPanel() {
  return mount(ChatSettingsPanel, {
    global: {
      stubs: {
        Avatar: true,
        Switch: SwitchStub,
        Textarea: true,
      },
    },
  })
}

function getRoomIdCopyButton(wrapper: ReturnType<typeof mountPanel>) {
  const button = wrapper.findAll('button').find((element) => element.text().includes('!project:localhost'))
  expect(button).toBeTruthy()
  return button!
}

describe('chat settings panel switches', () => {
  beforeEach(() => {
    toggleRoomMute.mockClear()
    toggleRoomPin.mockClear()
    clipboardMocks.writeText.mockReset()
    clipboardMocks.writeText.mockResolvedValue(undefined)
    toastMocks.error.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardMocks.writeText,
      },
    })
    resetChatStore()
    setCurrentRoom('!project:localhost')
  })

  it('does not double-toggle mute when clicking the switch control', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('[data-testid="switch-stub"]')[0]!.trigger('click')

    expect(toggleRoomMute).toHaveBeenCalledTimes(1)
    expect(isMuted('!project:localhost')).toBe(true)
  })

  it('does not double-toggle pin when clicking the switch control', async () => {
    const wrapper = mountPanel()

    await wrapper.findAll('[data-testid="switch-stub"]')[1]!.trigger('click')

    expect(toggleRoomPin).toHaveBeenCalledTimes(1)
    expect(isPinned('!project:localhost')).toBe(true)
  })

  it('shows a visible error when copying the room ID fails', async () => {
    clipboardMocks.writeText.mockRejectedValueOnce(new Error('permission denied'))
    const wrapper = mountPanel()

    await getRoomIdCopyButton(wrapper).trigger('click')
    await flushPromises()

    expect(toastMocks.error).toHaveBeenCalledWith('无法复制房间 ID')
  })
})
