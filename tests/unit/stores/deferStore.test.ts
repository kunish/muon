import { describe, expect, it } from 'vitest'
import {
  createDeferItem,
  isDeferActive,
  transitionDeferStatus,
} from '@/features/chat/types/defer'

describe('defer contracts (wave 0)', () => {
  it('defer item 必含 roomId/eventId、dueAt 且默认 status=deferred', () => {
    const item = createDeferItem({
      id: 'defer-1',
      roomId: '!room:example.org',
      eventId: '$event:example.org',
      dueAt: Date.now() + 60_000,
    })

    expect(item.roomId).toBe('!room:example.org')
    expect(item.eventId).toBe('$event:example.org')
    expect(item.dueAt).toBeGreaterThan(0)
    expect(item.status).toBe('deferred')
  })

  it('defer 从 deferred 迁移后不再属于 active 列表', () => {
    const base = createDeferItem({
      id: 'defer-2',
      roomId: '!room:example.org',
      eventId: '$event:example.org',
      dueAt: Date.now() + 120_000,
    })

    const completed = transitionDeferStatus(base, 'completed')
    const archived = transitionDeferStatus(base, 'archived')
    const activeItems = [base, completed, archived].filter(isDeferActive)

    expect(activeItems).toHaveLength(1)
    expect(activeItems[0]?.status).toBe('deferred')
  })
})
