import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MessageActionBar from '@/features/chat/components/MessageActionBar.vue'
import { resolveReminderDueAt, useDeferStore } from '@/features/chat/stores/deferStore'

vi.mock('@matrix/client', () => ({
  getClient: vi.fn(() => ({
    getUserId: vi.fn(() => '@me:localhost'),
  })),
}))

vi.mock('@matrix/index', () => ({
  redactMessage: vi.fn(async () => {}),
}))

vi.mock('@matrix/rooms', () => ({
  isMessagePinned: vi.fn(() => false),
  pinMessage: vi.fn(async () => {}),
  unpinMessage: vi.fn(async () => {}),
}))

function createEventMock() {
  return {
    getSender: () => '@alice:localhost',
    getId: () => '$event-1',
    getContent: () => ({ body: 'hello world' }),
  }
}

describe('MessageActionBar', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('creates deferred item from more menu and keeps source room/event', async () => {
    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-preset-tomorrow"]').trigger('click')

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    expect(deferStore.activeItems[0]).toMatchObject({
      roomId: '!room:test',
      eventId: '$event-1',
      status: 'deferred',
    })
  })

  it('uses shared preset/custom defer time logic', async () => {
    const now = new Date('2026-03-05T08:00:00Z').getTime()
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now)

    const wrapper = mount(MessageActionBar, {
      props: {
        event: createEventMock(),
        roomId: '!room:test',
      },
    })

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-preset-1h"]').trigger('click')

    const deferStore = useDeferStore()
    expect(deferStore.activeItems.length).toBe(1)
    expect(deferStore.activeItems[0]?.dueAt).toBe(resolveReminderDueAt({ preset: 'in-1-hour' }, now))

    await wrapper.find('[data-testid="message-more-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-trigger"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-custom-toggle"]').trigger('click')
    await wrapper.find('[data-testid="message-defer-custom-input"]').setValue('2026-03-06T10:30')
    await wrapper.find('[data-testid="message-defer-custom-submit"]').trigger('click')

    expect(deferStore.activeItems.length).toBe(2)
    const latestItem = deferStore.activeItems[1]
    expect(latestItem).toBeTruthy()
    expect(Math.abs((latestItem?.dueAt ?? 0) - new Date('2026-03-06T10:30:00').getTime())).toBeLessThan(60_000)

    nowSpy.mockRestore()
  })
})
