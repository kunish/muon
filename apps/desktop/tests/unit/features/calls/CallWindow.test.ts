import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallVideoTile from '@/features/calls/components/CallVideoTile.vue'
import CallWindow from '@/features/calls/components/CallWindow.vue'
import { useCallStore } from '@/features/calls/stores/callStore'

const media = vi.hoisted(() => ({
  localVideoTrack: { value: null as unknown },
  remoteVideos: { value: [] as Array<{ id: string; identity: string; track: unknown }> },
}))

vi.mock('@/features/calls/lib/callMedia', () => ({
  localVideoTrack: media.localVideoTrack,
  remoteVideos: media.remoteVideos,
  connectCallRoom: vi.fn().mockResolvedValue(undefined),
  disconnectCallRoom: vi.fn().mockResolvedValue(undefined),
  setCallMicEnabled: vi.fn().mockResolvedValue(undefined),
  setCallCameraEnabled: vi.fn().mockResolvedValue(undefined),
  setCallScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
}))

function fakeFeed(id: string) {
  return { id, identity: `@${id}:localhost`, track: { attach: vi.fn(), detach: vi.fn() } }
}

function mountWindow() {
  return mount(CallWindow, { global: { stubs: { teleport: true } } })
}

describe('call window', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    media.localVideoTrack.value = null
    media.remoteVideos.value = []
  })

  it('stays hidden for an audio call', () => {
    const store = useCallStore()
    store.status = 'connected'
    store.mode = 'audio'

    const wrapper = mountWindow()
    expect(wrapper.find('[data-testid="call-window"]').exists()).toBe(false)
  })

  it('renders the video stage and waiting state for a video call', () => {
    const store = useCallStore()
    store.status = 'connected'
    store.mode = 'video'
    store.peerName = 'Bob'

    const wrapper = mountWindow()
    const window = wrapper.find('[data-testid="call-window"]')
    expect(window.exists()).toBe(true)
    expect(window.text()).toContain('Bob')
    expect(window.text()).toContain('等待对方加入…')
  })

  it('renders one tile per remote participant plus the local preview', () => {
    media.remoteVideos.value = [fakeFeed('alice'), fakeFeed('bob')]
    const store = useCallStore()
    store.status = 'connected'
    store.mode = 'video'

    const wrapper = mountWindow()
    // 2 remote participants + 1 local tile = 3 tiles
    expect(wrapper.findAllComponents(CallVideoTile)).toHaveLength(3)
    // grid widens for multiple tiles
    expect(wrapper.get('[data-testid="call-window-grid"]').classes()).toContain('grid-cols-2')
    // remote present → no waiting overlay
    expect(wrapper.text()).not.toContain('等待对方加入…')
  })

  it('routes mute, camera and hangup controls to the store', async () => {
    const store = useCallStore()
    store.status = 'connected'
    store.mode = 'video'
    const mute = vi.spyOn(store, 'toggleMute').mockResolvedValue()
    const camera = vi.spyOn(store, 'toggleCamera').mockResolvedValue()
    const screen = vi.spyOn(store, 'toggleScreenShare').mockResolvedValue()
    const hangup = vi.spyOn(store, 'hangup').mockResolvedValue()

    const wrapper = mountWindow()
    await wrapper.find('[data-testid="call-window-mute"]').trigger('click')
    await wrapper.find('[data-testid="call-window-camera"]').trigger('click')
    await wrapper.find('[data-testid="call-window-screen"]').trigger('click')
    await wrapper.find('[data-testid="call-window-hangup"]').trigger('click')

    expect(mute).toHaveBeenCalledOnce()
    expect(camera).toHaveBeenCalledOnce()
    expect(screen).toHaveBeenCalledOnce()
    expect(hangup).toHaveBeenCalledOnce()
  })
})
