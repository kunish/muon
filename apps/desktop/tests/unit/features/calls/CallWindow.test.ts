import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallVideoTile from '@/features/calls/components/CallVideoTile.vue'
import CallWindow from '@/features/calls/components/CallWindow.vue'
import { callStore, resetCallStore } from '@/features/calls/stores/callStore'

const media = vi.hoisted(() => ({
  localVideoTrack: { value: null as unknown },
  remoteVideos: { value: [] as Array<{ id: string; identity: string; track: unknown }> },
  callParticipants: { value: [] as Array<Record<string, unknown>> },
}))

vi.mock('@/features/calls/lib/callMedia', () => ({
  localVideoTrack: media.localVideoTrack,
  remoteVideos: media.remoteVideos,
  callParticipants: media.callParticipants,
  connectCallRoom: vi.fn().mockResolvedValue(undefined),
  disconnectCallRoom: vi.fn().mockResolvedValue(undefined),
  setCallMicEnabled: vi.fn().mockResolvedValue(undefined),
  setCallCameraEnabled: vi.fn().mockResolvedValue(undefined),
  setCallScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
  startCallRecording: vi.fn().mockResolvedValue(undefined),
  stopCallRecording: vi.fn().mockResolvedValue(undefined),
}))

const callActions = vi.hoisted(() => ({
  toggleMute: vi.fn().mockResolvedValue(undefined),
  toggleCamera: vi.fn().mockResolvedValue(undefined),
  toggleScreenShare: vi.fn().mockResolvedValue(undefined),
  toggleRecording: vi.fn().mockResolvedValue(undefined),
  hangup: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/calls/stores/callStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/calls/stores/callStore')>()),
  toggleMute: callActions.toggleMute,
  toggleCamera: callActions.toggleCamera,
  toggleScreenShare: callActions.toggleScreenShare,
  toggleRecording: callActions.toggleRecording,
  hangup: callActions.hangup,
}))

function fakeFeed(id: string) {
  return { id, identity: `@${id}:localhost`, track: { attach: vi.fn(), detach: vi.fn() } }
}

function mountWindow() {
  return mount(CallWindow, { global: { stubs: { teleport: true } } })
}

describe('call window', () => {
  beforeEach(() => {
    resetCallStore()
    vi.clearAllMocks()
    media.localVideoTrack.value = null
    media.remoteVideos.value = []
    media.callParticipants.value = []
  })

  it('stays hidden for an audio call', () => {
    callStore.setState((s) => ({ ...s, status: 'connected', mode: 'audio' }))

    const wrapper = mountWindow()
    expect(wrapper.find('[data-testid="call-window"]').exists()).toBe(false)
  })

  it('renders the video stage and waiting state for a video call', () => {
    callStore.setState((s) => ({ ...s, status: 'connected', mode: 'video', peerName: 'Bob' }))

    const wrapper = mountWindow()
    const window = wrapper.find('[data-testid="call-window"]')
    expect(window.exists()).toBe(true)
    expect(window.text()).toContain('Bob')
    expect(window.text()).toContain('等待对方加入…')
  })

  it('renders one tile per remote participant plus the local preview', () => {
    media.remoteVideos.value = [fakeFeed('alice'), fakeFeed('bob')]
    callStore.setState((s) => ({ ...s, status: 'connected', mode: 'video' }))

    const wrapper = mountWindow()
    // 2 remote participants + 1 local tile = 3 tiles
    expect(wrapper.findAllComponents(CallVideoTile)).toHaveLength(3)
    // grid widens for multiple tiles
    expect(wrapper.get('[data-testid="call-window-grid"]').classes()).toContain('grid-cols-2')
    // remote present → no waiting overlay
    expect(wrapper.text()).not.toContain('等待对方加入…')
  })

  it('routes mute, camera and hangup controls to the store', async () => {
    callStore.setState((s) => ({ ...s, status: 'connected', mode: 'video' }))

    const wrapper = mountWindow()
    await wrapper.find('[data-testid="call-window-mute"]').trigger('click')
    await wrapper.find('[data-testid="call-window-camera"]').trigger('click')
    await wrapper.find('[data-testid="call-window-screen"]').trigger('click')
    await wrapper.find('[data-testid="call-window-record"]').trigger('click')
    await wrapper.find('[data-testid="call-window-hangup"]').trigger('click')

    expect(callActions.toggleMute).toHaveBeenCalledOnce()
    expect(callActions.toggleCamera).toHaveBeenCalledOnce()
    expect(callActions.toggleScreenShare).toHaveBeenCalledOnce()
    expect(callActions.toggleRecording).toHaveBeenCalledOnce()
    expect(callActions.hangup).toHaveBeenCalledOnce()
  })
})
