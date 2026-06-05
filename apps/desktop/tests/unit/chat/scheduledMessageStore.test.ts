import { beforeEach, describe, expect, it } from 'vitest'
import {
  cancel,
  dueMessages,
  pendingForRoom,
  remove,
  resetScheduledMessageStore,
  schedule,
  SCHEDULED_MESSAGES_STORAGE_KEY,
  scheduledMessageStore,
  selectPendingCount,
} from '@/features/chat/stores/scheduledMessageStore'

describe('scheduledMessageStore', () => {
  beforeEach(() => {
    localStorage.clear()
    resetScheduledMessageStore()
  })

  it('schedules a message, persists it, and keeps the queue time-sorted', () => {
    schedule({ roomId: '!r:localhost', body: 'later', sendAt: 3000 })
    schedule({ roomId: '!r:localhost', body: 'sooner', sendAt: 1000 })

    expect(scheduledMessageStore.state.messages.map((m) => m.body)).toEqual(['sooner', 'later'])
    const stored = JSON.parse(localStorage.getItem(SCHEDULED_MESSAGES_STORAGE_KEY) || '{}')
    expect(stored.version).toBe(1)
    expect(stored.messages).toHaveLength(2)
  })

  it('returns only due messages for a given time', () => {
    schedule({ roomId: '!r:localhost', body: 'a', sendAt: 1000 })
    schedule({ roomId: '!r:localhost', body: 'b', sendAt: 5000 })

    expect(dueMessages(2000).map((m) => m.body)).toEqual(['a'])
    expect(dueMessages(9000).map((m) => m.body)).toEqual(['a', 'b'])
  })

  it('removes sent messages and cancels pending ones', () => {
    const first = schedule({ roomId: '!r:localhost', body: 'a', sendAt: 1000 })
    const second = schedule({ roomId: '!other:localhost', body: 'b', sendAt: 2000 })

    remove([first.id])
    expect(scheduledMessageStore.state.messages.map((m) => m.id)).toEqual([second.id])
    expect(pendingForRoom('!other:localhost')).toHaveLength(1)

    cancel(second.id)
    expect(selectPendingCount(scheduledMessageStore.state)).toBe(0)
  })

  it('hydrates the queue from storage on creation', () => {
    schedule({ roomId: '!r:localhost', body: 'persisted', sendAt: 1000 })

    // Simulate reload: reset from localStorage (which was persisted by subscribe)
    resetScheduledMessageStore()
    // After reset, state is re-hydrated from localStorage
    expect(scheduledMessageStore.state.messages.map((m) => m.body)).toEqual(['persisted'])
  })
})
