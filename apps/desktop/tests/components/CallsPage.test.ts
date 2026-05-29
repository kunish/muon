import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import CallsPage from '@/features/calls/components/CallsPage.vue'
import { useCallStore } from '@/features/calls/stores/callStore'

const findOrCreateDm = vi.hoisted(() => vi.fn().mockResolvedValue('!dm:localhost'))

vi.mock('@/features/calls/lib/callMedia', () => ({
  connectCallRoom: vi.fn().mockResolvedValue(undefined),
  disconnectCallRoom: vi.fn().mockResolvedValue(undefined),
  setCallMicEnabled: vi.fn().mockResolvedValue(undefined),
  setCallCameraEnabled: vi.fn().mockResolvedValue(undefined),
  setCallScreenShareEnabled: vi.fn().mockResolvedValue(undefined),
  localVideoTrack: { value: null },
  remoteVideos: { value: [] },
}))

vi.mock('@matrix/index', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@matrix/index')>()),
  findOrCreateDm,
}))

const GroupMemberPickerStub = defineComponent({
  name: 'GroupMemberPicker',
  props: { modelValue: { type: Array, default: () => [] } },
  emits: ['update:modelValue'],
  setup(_, { emit }) {
    return () =>
      h(
        'button',
        { 'data-testid': 'pick-alice', onClick: () => emit('update:modelValue', ['@alice:localhost']) },
        'pick',
      )
  },
})

function mountCalls() {
  return mount(CallsPage, { global: { stubs: { GroupMemberPicker: GroupMemberPickerStub } } })
}

describe('calls page', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    findOrCreateDm.mockClear()
  })

  it('shows an empty state and zero stats with no history', () => {
    const wrapper = mountCalls()
    expect(wrapper.find('[data-testid="calls-empty"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="calls-stat-total"]').text()).toBe('0')
    expect(wrapper.get('[data-testid="calls-stat-missed"]').text()).toBe('0')
  })

  it('renders real call history entries from the store', () => {
    const store = useCallStore()
    store.callHistory = [
      {
        id: 'c1',
        peerId: '@alice:localhost',
        peerName: 'Alice',
        mode: 'video',
        direction: 'outgoing',
        outcome: 'completed',
        durationSec: 90,
        endedAt: 1700000000000,
      },
      {
        id: 'c2',
        peerId: '@bob:localhost',
        peerName: 'Bob',
        mode: 'audio',
        direction: 'incoming',
        outcome: 'missed',
        durationSec: 0,
        endedAt: 1700000100000,
      },
    ]

    const wrapper = mountCalls()
    expect(wrapper.get('[data-testid="calls-stat-total"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="calls-stat-missed"]').text()).toBe('1')

    const completed = wrapper.get('[data-testid="calls-record-c1"]')
    expect(completed.text()).toContain('Alice')
    expect(completed.text()).toContain('01:30')

    expect(wrapper.get('[data-testid="calls-record-c2"]').text()).toContain('未接')
  })

  it('starts a real call with the picked contact', async () => {
    const store = useCallStore()
    const startCall = vi.spyOn(store, 'startCall').mockResolvedValue()

    const wrapper = mountCalls()
    await wrapper.get('[data-testid="calls-start"]').trigger('click')
    await wrapper.get('[data-testid="pick-alice"]').trigger('click')
    await wrapper.get('[data-testid="calls-launch-confirm"]').trigger('click')
    await flushPromises()

    expect(findOrCreateDm).toHaveBeenCalledWith('@alice:localhost')
    expect(startCall).toHaveBeenCalledWith('!dm:localhost', '@alice:localhost', expect.any(String), 'video')
  })
})
