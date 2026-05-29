import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallOverlay from '@/features/calls/components/CallOverlay.vue'
import { useCallStore } from '@/features/calls/stores/callStore'

function mountOverlay() {
  return mount(CallOverlay, { global: { stubs: { teleport: true } } })
}

describe('call overlay', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders nothing while idle', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="call-incoming"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="call-active"]').exists()).toBe(false)
  })

  it('shows the incoming banner and routes accept/decline to the store', async () => {
    const store = useCallStore()
    store.status = 'incoming'
    store.peerName = 'Alice'
    store.peerId = '@alice:localhost'
    const accept = vi.spyOn(store, 'acceptCall').mockResolvedValue()
    const decline = vi.spyOn(store, 'declineCall').mockImplementation(() => {})

    const wrapper = mountOverlay()
    const banner = wrapper.find('[data-testid="call-incoming"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Alice')
    expect(banner.text()).toContain('来电')
    expect(wrapper.find('[data-testid="call-active"]').exists()).toBe(false)

    await wrapper.find('[data-testid="call-decline"]').trigger('click')
    expect(decline).toHaveBeenCalledOnce()
    await wrapper.find('[data-testid="call-accept"]').trigger('click')
    expect(accept).toHaveBeenCalledOnce()
  })

  it('shows the active call bar and routes mute/hangup to the store', async () => {
    const store = useCallStore()
    store.status = 'connected'
    store.peerName = 'Bob'
    store.peerId = '@bob:localhost'
    const mute = vi.spyOn(store, 'toggleMute').mockResolvedValue()
    const hangup = vi.spyOn(store, 'hangup').mockResolvedValue()

    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="call-incoming"]').exists()).toBe(false)
    const bar = wrapper.find('[data-testid="call-active"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('Bob')

    await wrapper.find('[data-testid="call-mute"]').trigger('click')
    expect(mute).toHaveBeenCalledOnce()
    await wrapper.find('[data-testid="call-hangup"]').trigger('click')
    expect(hangup).toHaveBeenCalledOnce()
  })

  it('renders the outgoing status label before the call connects', () => {
    const store = useCallStore()
    store.status = 'outgoing'
    store.peerName = 'Carol'

    const wrapper = mountOverlay()
    const status = wrapper.find('[data-testid="call-status"]')
    expect(status.exists()).toBe(true)
    expect(status.text()).toBe('正在呼叫…')
  })
})
