import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockClient } from '../../mocks/matrix'

function createEvent(eventId: string) {
  return {
    getId: () => eventId,
  } as any
}

function createTimeline(events: any[]) {
  return {
    getEvents: vi.fn(() => events),
  } as any
}

describe('inbox context loader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(mockClient.getRoom).mockReturnValue({
      getUnfilteredTimelineSet: vi.fn(() => ({ id: 'timeline-set' })),
    } as any)
    vi.mocked(mockClient.getEventTimeline).mockResolvedValue(null)
    vi.mocked(mockClient.getEventContext).mockResolvedValue(null)
    vi.mocked(mockClient.paginateEventTimeline).mockResolvedValue(true)
  })

  it('returns target event with before/after context when timeline contains event', async () => {
    const eventsBefore = [createEvent('$before1'), createEvent('$before2')]
    const event = createEvent('$target')
    const eventsAfter = [createEvent('$after1')]
    const timeline = createTimeline([...eventsBefore, event, ...eventsAfter])

    vi.mocked(mockClient.getEventTimeline).mockResolvedValue(timeline)

    const { loadInboxEventContext } = await import('@/matrix/inbox')
    const context = await loadInboxEventContext('!room:localhost', '$target', 5)

    expect(mockClient.getEventTimeline).toHaveBeenCalledOnce()
    expect(mockClient.paginateEventTimeline).toHaveBeenNthCalledWith(1, timeline, { backwards: true, limit: 5 })
    expect(mockClient.paginateEventTimeline).toHaveBeenNthCalledWith(2, timeline, { backwards: false, limit: 5 })
    expect(context.event).toBe(event)
    expect(context.eventsBefore).toEqual(eventsBefore)
    expect(context.eventsAfter).toEqual(eventsAfter)
  })

  it('falls back to SDK context API when live timeline misses target event', async () => {
    vi.mocked(mockClient.getEventTimeline).mockResolvedValue(createTimeline([createEvent('$other')]))

    const event = createEvent('$target')
    const eventsBefore = [createEvent('$before')]
    const eventsAfter = [createEvent('$after')]
    vi.mocked(mockClient.getEventContext).mockResolvedValue({
      event,
      events_before: eventsBefore,
      events_after: eventsAfter,
    } as any)

    const { loadInboxEventContext } = await import('@/matrix/inbox')
    const context = await loadInboxEventContext('!room:localhost', '$target', 3)

    expect(mockClient.getEventContext).toHaveBeenCalledWith('!room:localhost', '$target', 3)
    expect(context.event).toBe(event)
    expect(context.eventsBefore).toEqual(eventsBefore)
    expect(context.eventsAfter).toEqual(eventsAfter)
  })

  it('throws identifiable error on context load failure', async () => {
    vi.mocked(mockClient.getEventTimeline).mockRejectedValue(new Error('timeline failed'))
    vi.mocked(mockClient.getEventContext).mockRejectedValue(new Error('context failed'))

    const { loadInboxEventContext } = await import('@/matrix/inbox')

    await expect(loadInboxEventContext('!room:localhost', '$target')).rejects.toThrow(
      'Failed to load inbox event context',
    )
  })
})
