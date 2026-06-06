import type { MatrixEvent } from 'matrix-js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useMessages } from '@/features/chat/composables/useMessages'
import { resetChatStore, setCurrentRoom } from '@/features/chat/stores/chatStore'

const {
  getTimelineMock,
  matrixEventsMock,
  matrixEventHandlers,
  paginateBackMock,
  paginateResolvers,
  relationSummariesMock,
  sendReadReceiptMock,
  syncStateMock,
  timelines,
} = vi.hoisted(() => {
  const timelines = new Map<string, MatrixEvent[]>()
  const paginateResolvers = new Map<string, (loaded: boolean) => void>()
  const matrixEventHandlers = new Map<string, Set<(...args: any[]) => void>>()
  return {
    timelines,
    matrixEventHandlers,
    paginateResolvers,
    getTimelineMock: vi.fn((roomId: string) => timelines.get(roomId) ?? []),
    matrixEventsMock: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        const handlers = matrixEventHandlers.get(event) ?? new Set()
        handlers.add(handler)
        matrixEventHandlers.set(event, handlers)
      }),
      off: vi.fn((event: string, handler: (...args: any[]) => void) => {
        matrixEventHandlers.get(event)?.delete(handler)
      }),
    },
    paginateBackMock: vi.fn(
      (roomId: string) =>
        new Promise<boolean>((resolve) => {
          paginateResolvers.set(roomId, resolve)
        }),
    ),
    relationSummariesMock: vi.fn(() => ({
      reactionsByEventId: new Map(),
      threadReplyCountsByEventId: new Map(),
    })),
    sendReadReceiptMock: vi.fn().mockResolvedValue(undefined),
    syncStateMock: { value: 'PREPARED' },
  }
})

vi.mock('@matrix/index', () => ({
  getTimeline: getTimelineMock,
  getTimelineRelationSummaries: relationSummariesMock,
  matrixEvents: matrixEventsMock,
  paginateBack: paginateBackMock,
  sendReadReceipt: sendReadReceiptMock,
  syncState: syncStateMock,
}))

function createEvent(id: string): MatrixEvent {
  return {
    getId: () => id,
  } as unknown as MatrixEvent
}

function eventIds(events: MatrixEvent[]): string[] {
  return events.map((event) => event.getId() ?? '')
}

describe('useMessages', () => {
  beforeEach(() => {
    timelines.clear()
    paginateResolvers.clear()
    matrixEventHandlers.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()
    sendReadReceiptMock.mockClear()
    matrixEventsMock.on.mockClear()
    matrixEventsMock.off.mockClear()
    syncStateMock.value = 'PREPARED'
    resetChatStore()
  })

  it('ignores stale pagination results after switching rooms', async () => {
    timelines.set('!room-a:localhost', [createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    let api!: ReturnType<typeof useMessages>
    const Harness = defineComponent({
      setup() {
        api = useMessages()
        return () => h('div')
      },
    })

    setCurrentRoom('!room-a:localhost')

    const wrapper = mount(Harness)
    await nextTick()
    expect(eventIds(api.messages.value)).toEqual(['$a-new'])

    const loadMorePromise = api.loadMore()
    expect(paginateBackMock).toHaveBeenCalledWith('!room-a:localhost', 30)

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    setCurrentRoom('!room-b:localhost')
    await nextTick()
    expect(eventIds(api.messages.value)).toEqual(['$b-new'])

    paginateResolvers.get('!room-a:localhost')?.(true)
    await loadMorePromise
    await nextTick()

    expect(eventIds(api.messages.value)).toEqual(['$b-new'])
    wrapper.unmount()
  })

  it('refreshes the current room when startup sync arrives without a timeline event', async () => {
    timelines.set('!room:localhost', [createEvent('$old')])

    let api!: ReturnType<typeof useMessages>
    const Harness = defineComponent({
      setup() {
        api = useMessages()
        return () => h('div')
      },
    })

    setCurrentRoom('!room:localhost')

    const wrapper = mount(Harness)
    await nextTick()
    expect(eventIds(api.messages.value)).toEqual(['$old'])

    timelines.set('!room:localhost', [createEvent('$old'), createEvent('$latest')])
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'PREPARED' })
    await nextTick()

    expect(eventIds(api.messages.value)).toEqual(['$old', '$latest'])
    wrapper.unmount()
  })

  it('keeps cached room messages visible without toggling the visible loading state during background backfill', async () => {
    timelines.set('!room:localhost', [createEvent('$cached')])
    let resolvePaginate: ((loaded: boolean) => void) | null = null
    paginateBackMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePaginate = resolve
        }),
    )

    let api!: ReturnType<typeof useMessages>
    const Harness = defineComponent({
      setup() {
        api = useMessages()
        return () => h('div')
      },
    })

    setCurrentRoom('!room:localhost')

    const wrapper = mount(Harness)
    await nextTick()

    expect(eventIds(api.messages.value)).toEqual(['$cached'])
    expect(paginateBackMock).toHaveBeenCalledWith('!room:localhost', 30)
    expect(api.isLoading.value).toBe(false)

    resolvePaginate?.(false)
    await flushPromises()
    await nextTick()

    expect(api.isLoading.value).toBe(false)
    wrapper.unmount()
  })

  it('backfills the current room on entry when startup sync only contains a short timeline', async () => {
    const initialEvents = Array.from({ length: 2 }, (_, index) => createEvent(`$initial-${index}`))
    const hydratedEvents = [
      ...Array.from({ length: 48 }, (_, index) => createEvent(`$older-${index}`)),
      ...initialEvents,
    ]
    timelines.set('!room:localhost', initialEvents)
    paginateBackMock.mockImplementationOnce(async () => {
      timelines.set('!room:localhost', hydratedEvents)
      return true
    })

    let api!: ReturnType<typeof useMessages>
    const Harness = defineComponent({
      setup() {
        api = useMessages()
        return () => h('div')
      },
    })

    setCurrentRoom('!room:localhost')

    const wrapper = mount(Harness)
    await flushPromises()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!room:localhost', 30)
    expect(eventIds(api.messages.value)).toHaveLength(50)
    expect(eventIds(api.messages.value).at(0)).toBe('$older-0')
    expect(eventIds(api.messages.value).at(-1)).toBe('$initial-1')
    wrapper.unmount()
  })

  it('waits for Matrix sync readiness before backfilling the active room history', async () => {
    syncStateMock.value = 'STOPPED'
    timelines.set('!room:localhost', [])
    paginateBackMock.mockImplementationOnce(async () => {
      timelines.set('!room:localhost', [createEvent('$older'), createEvent('$latest')])
      return true
    })

    let api!: ReturnType<typeof useMessages>
    const Harness = defineComponent({
      setup() {
        api = useMessages()
        return () => h('div')
      },
    })

    setCurrentRoom('!room:localhost')

    const wrapper = mount(Harness)
    await flushPromises()
    expect(paginateBackMock).not.toHaveBeenCalled()

    timelines.set('!room:localhost', [createEvent('$latest')])
    syncStateMock.value = 'PREPARED'
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'PREPARED' })
    await flushPromises()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!room:localhost', 30)
    expect(eventIds(api.messages.value)).toEqual(['$older', '$latest'])
    wrapper.unmount()
  })

  it('retries history backfill when the active room timeline appears after an early empty refresh', async () => {
    vi.useFakeTimers()
    try {
      syncStateMock.value = 'PREPARED'
      timelines.set('!room:localhost', [])
      paginateBackMock
        .mockImplementationOnce(async () => false)
        .mockImplementationOnce(async () => {
          timelines.set('!room:localhost', [createEvent('$older'), createEvent('$latest')])
          return true
        })
        .mockImplementationOnce(async () => false)

      let api!: ReturnType<typeof useMessages>
      const Harness = defineComponent({
        setup() {
          api = useMessages()
          return () => h('div')
        },
      })

      setCurrentRoom('!room:localhost')

      const wrapper = mount(Harness)
      await flushPromises()
      await nextTick()

      expect(paginateBackMock).toHaveBeenCalledTimes(1)
      expect(eventIds(api.messages.value)).toEqual([])

      timelines.set('!room:localhost', [createEvent('$latest')])
      for (const handler of matrixEventHandlers.get('room.timeline') ?? []) handler({ roomId: '!room:localhost' })

      await vi.advanceTimersByTimeAsync(90)
      await flushPromises()
      await nextTick()

      expect(paginateBackMock).toHaveBeenCalledTimes(3)
      expect(eventIds(api.messages.value)).toEqual(['$older', '$latest'])
      wrapper.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})
