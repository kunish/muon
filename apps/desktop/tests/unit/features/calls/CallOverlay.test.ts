import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CallOverlay from '@/features/calls/components/CallOverlay.vue'
import { callStore, resetCallStore } from '@/features/calls/stores/callStore'

const callActions = vi.hoisted(() => ({
  acceptCall: vi.fn().mockResolvedValue(undefined),
  declineCall: vi.fn(),
  toggleMute: vi.fn().mockResolvedValue(undefined),
  hangup: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/features/calls/stores/callStore', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/calls/stores/callStore')>()),
  acceptCall: callActions.acceptCall,
  declineCall: callActions.declineCall,
  toggleMute: callActions.toggleMute,
  hangup: callActions.hangup,
}))

function mountOverlay() {
  return mount(CallOverlay, { global: { stubs: { teleport: true } } })
}

describe('call overlay', () => {
  beforeEach(() => {
    resetCallStore()
    vi.clearAllMocks()
  })

  it('renders nothing while idle', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="call-incoming"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="call-active"]').exists()).toBe(false)
  })

  it('shows the incoming banner and routes accept/decline to the store', async () => {
    callStore.setState((s) => ({ ...s, status: 'incoming', peerName: 'Alice', peerId: '@alice:localhost' }))

    const wrapper = mountOverlay()
    const banner = wrapper.find('[data-testid="call-incoming"]')
    expect(banner.exists()).toBe(true)
    expect(banner.text()).toContain('Alice')
    expect(banner.text()).toContain('来电')
    expect(wrapper.find('[data-testid="call-active"]').exists()).toBe(false)

    await wrapper.find('[data-testid="call-decline"]').trigger('click')
    expect(callActions.declineCall).toHaveBeenCalledOnce()
    await wrapper.find('[data-testid="call-accept"]').trigger('click')
    expect(callActions.acceptCall).toHaveBeenCalledOnce()
  })

  it('shows the active call bar and routes mute/hangup to the store', async () => {
    callStore.setState((s) => ({ ...s, status: 'connected', peerName: 'Bob', peerId: '@bob:localhost' }))

    const wrapper = mountOverlay()
    expect(wrapper.find('[data-testid="call-incoming"]').exists()).toBe(false)
    const bar = wrapper.find('[data-testid="call-active"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('Bob')

    await wrapper.find('[data-testid="call-mute"]').trigger('click')
    expect(callActions.toggleMute).toHaveBeenCalledOnce()
    await wrapper.find('[data-testid="call-hangup"]').trigger('click')
    expect(callActions.hangup).toHaveBeenCalledOnce()
  })

  it('renders the outgoing status label before the call connects', () => {
    callStore.setState((s) => ({ ...s, status: 'outgoing', peerName: 'Carol' }))

    const wrapper = mountOverlay()
    const status = wrapper.find('[data-testid="call-status"]')
    expect(status.exists()).toBe(true)
    expect(status.text()).toBe('正在呼叫…')
  })
})
