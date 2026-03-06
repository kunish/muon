import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import UnifiedInboxPanel from '@/features/chat/components/UnifiedInboxPanel.vue'
import { __resetUnifiedInboxForTests } from '@/features/chat/composables/useUnifiedInbox'
import { matrixEvents } from '@/matrix/events'
import { mockClient } from '../mocks/matrix'
import { createMatrixEvent, createRecoveryRoom } from '../mocks/recovery'

async function flushInboxRecovery() {
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 120))
  await nextTick()
}

describe('UnifiedInboxPanel recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    localStorage.clear()
    __resetUnifiedInboxForTests()
  })

  it('recomputes inbox items from canonical room data after recovery without waiting for a fresh room.message event', async () => {
    const liveEvents = [createMatrixEvent({ eventId: '$old', ts: 100, body: 'stale summary body' })]
    const staleRoom = createRecoveryRoom({
      roomId: '!stale:localhost',
      name: 'Recovered Project',
      timelineEvents: [createMatrixEvent({ eventId: '$old', ts: 100, body: 'stale summary body' })],
      liveTimelineEvents: liveEvents,
      unreadCount: 2,
    })

    vi.mocked(mockClient.getRooms).mockReturnValue([staleRoom])
    vi.mocked(mockClient.getRoom).mockImplementation((roomId: string) => (roomId === staleRoom.roomId ? staleRoom : null))

    const wrapper = mount(UnifiedInboxPanel)
    await flushInboxRecovery()

    expect(wrapper.text()).toContain('stale summary body')

    liveEvents.splice(0, liveEvents.length, createMatrixEvent({ eventId: '$new', ts: 300, body: 'recovered latest body' }))

    matrixEvents.emit('sync.state', { state: 'CATCHUP' })
    await flushInboxRecovery()

    expect(wrapper.text()).toContain('recovered latest body')
    expect(wrapper.text()).not.toContain('stale summary body')
  })

  it('keeps latest visible inbox ordering stable during limited-timeline recovery', async () => {
    const firstRoom = createRecoveryRoom({
      roomId: '!first:localhost',
      name: 'Newest Room',
      timelineEvents: [createMatrixEvent({ eventId: '$first-stale', ts: 100, body: 'older fallback' })],
      liveTimelineEvents: [createMatrixEvent({ eventId: '$first-live', ts: 500, body: 'newest visible event' })],
      unreadCount: 1,
    })
    const secondRoom = createRecoveryRoom({
      roomId: '!second:localhost',
      name: 'Older Room',
      timelineEvents: [createMatrixEvent({ eventId: '$second-stale', ts: 200, body: 'second room body' })],
      liveTimelineEvents: [createMatrixEvent({ eventId: '$second-live', ts: 400, body: 'second room latest' })],
      unreadCount: 1,
    })

    vi.mocked(mockClient.getRooms).mockReturnValue([firstRoom, secondRoom])
    vi.mocked(mockClient.getRoom).mockImplementation((roomId: string) => {
      if (roomId === firstRoom.roomId)
        return firstRoom
      if (roomId === secondRoom.roomId)
        return secondRoom
      return null
    })

    const wrapper = mount(UnifiedInboxPanel)
    await flushInboxRecovery()

    matrixEvents.emit('sync.state', { state: 'PREPARED' })
    await flushInboxRecovery()

    const jumpButtons = wrapper.findAll('[data-testid^="inbox-jump-"]')
    expect(jumpButtons[0]?.text()).toContain('Newest Room')
    expect(jumpButtons[1]?.text()).toContain('Older Room')
    expect(wrapper.text()).toContain('newest visible event')
    expect(wrapper.text()).not.toContain('older fallback')
  })
})
