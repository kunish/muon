import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { SCHEDULED_MESSAGES_STORAGE_KEY, useScheduledMessageStore } from '@/features/chat/stores/scheduledMessageStore'

describe('scheduledMessageStore', () => {
  beforeEach(() => {
    localStorage.removeItem(SCHEDULED_MESSAGES_STORAGE_KEY)
    setActivePinia(createPinia())
  })

  it('schedules a message, persists it, and keeps the queue time-sorted', () => {
    const store = useScheduledMessageStore()
    store.schedule({ roomId: '!r:localhost', body: 'later', sendAt: 3000 })
    store.schedule({ roomId: '!r:localhost', body: 'sooner', sendAt: 1000 })

    expect(store.messages.map((m) => m.body)).toEqual(['sooner', 'later'])
    const stored = JSON.parse(localStorage.getItem(SCHEDULED_MESSAGES_STORAGE_KEY) || '{}')
    expect(stored.version).toBe(1)
    expect(stored.messages).toHaveLength(2)
  })

  it('returns only due messages for a given time', () => {
    const store = useScheduledMessageStore()
    store.schedule({ roomId: '!r:localhost', body: 'a', sendAt: 1000 })
    store.schedule({ roomId: '!r:localhost', body: 'b', sendAt: 5000 })

    expect(store.dueMessages(2000).map((m) => m.body)).toEqual(['a'])
    expect(store.dueMessages(9000).map((m) => m.body)).toEqual(['a', 'b'])
  })

  it('removes sent messages and cancels pending ones', () => {
    const store = useScheduledMessageStore()
    const first = store.schedule({ roomId: '!r:localhost', body: 'a', sendAt: 1000 })
    const second = store.schedule({ roomId: '!other:localhost', body: 'b', sendAt: 2000 })

    store.remove([first.id])
    expect(store.messages.map((m) => m.id)).toEqual([second.id])
    expect(store.pendingForRoom('!other:localhost')).toHaveLength(1)

    store.cancel(second.id)
    expect(store.pendingCount).toBe(0)
  })

  it('hydrates the queue from storage on creation', () => {
    const seed = useScheduledMessageStore()
    seed.schedule({ roomId: '!r:localhost', body: 'persisted', sendAt: 1000 })

    setActivePinia(createPinia())
    const reloaded = useScheduledMessageStore()
    expect(reloaded.messages.map((m) => m.body)).toEqual(['persisted'])
  })
})
