import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallWindow from '@/features/calls/components/CallWindow.vue'
import { useCallStore } from '@/features/calls/stores/callStore'

vi.mock('@/features/calls/lib/callMedia', () => ({
  localVideoTrack: { value: null },
  remoteVideos: { value: [] },
  connectCallRoom: vi.fn().mockResolvedValue(undefined),
  disconnectCallRoom: vi.fn().mockResolvedValue(undefined),
  setCallMicEnabled: vi.fn().mockResolvedValue(undefined),
  setCallCameraEnabled: vi.fn().mockResolvedValue(undefined),
}))

function mountWindow() {
  return mount(CallWindow, { global: { stubs: { teleport: true } } })
}

describe('call window', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
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

  it('routes mute, camera and hangup controls to the store', async () => {
    const store = useCallStore()
    store.status = 'connected'
    store.mode = 'video'
    const mute = vi.spyOn(store, 'toggleMute').mockResolvedValue()
    const camera = vi.spyOn(store, 'toggleCamera').mockResolvedValue()
    const hangup = vi.spyOn(store, 'hangup').mockResolvedValue()

    const wrapper = mountWindow()
    await wrapper.find('[data-testid="call-window-mute"]').trigger('click')
    await wrapper.find('[data-testid="call-window-camera"]').trigger('click')
    await wrapper.find('[data-testid="call-window-hangup"]').trigger('click')

    expect(mute).toHaveBeenCalledOnce()
    expect(camera).toHaveBeenCalledOnce()
    expect(hangup).toHaveBeenCalledOnce()
  })
})
