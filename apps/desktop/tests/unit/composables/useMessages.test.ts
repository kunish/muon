import type { MatrixEvent } from 'matrix-js-sdk'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useMessages } from '@/features/chat/composables/useMessages'
import { useChatStore } from '@/features/chat/stores/chatStore'

const {
  getTimelineMock,
  matrixEventsMock,
  matrixEventHandlers,
  paginateBackMock,
  paginateResolvers,
  relationSummariesMock,
  sendReadReceiptMock,
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
  }
})

vi.mock('@matrix/index', () => ({
  getTimeline: getTimelineMock,
  getTimelineRelationSummaries: relationSummariesMock,
  matrixEvents: matrixEventsMock,
  paginateBack: paginateBackMock,
  sendReadReceipt: sendReadReceiptMock,
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

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const wrapper = mount(Harness)
    await nextTick()
    expect(eventIds(api.messages.value)).toEqual(['$a-new'])

    const loadMorePromise = api.loadMore()
    expect(paginateBackMock).toHaveBeenCalledWith('!room-a:localhost', 30)

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    store.setCurrentRoom('!room-b:localhost')
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

    const store = useChatStore()
    store.setCurrentRoom('!room:localhost')

    const wrapper = mount(Harness)
    await nextTick()
    expect(eventIds(api.messages.value)).toEqual(['$old'])

    timelines.set('!room:localhost', [createEvent('$old'), createEvent('$latest')])
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'PREPARED' })
    await nextTick()

    expect(eventIds(api.messages.value)).toEqual(['$old', '$latest'])
    wrapper.unmount()
  })
})
