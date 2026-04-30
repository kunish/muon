import type { MatrixEvent } from 'matrix-js-sdk'
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { useChatStore } from '@/features/chat/stores/chatStore'

const {
  getReadMarkerEventIdMock,
  getTimelineMock,
  matrixEventsMock,
  paginateBackMock,
  relationSummariesMock,
  sendReadReceiptMock,
  timelines,
} = vi.hoisted(() => {
  const timelines = new Map<string, MatrixEvent[]>()
  return {
    timelines,
    getReadMarkerEventIdMock: vi.fn().mockReturnValue(null),
    getTimelineMock: vi.fn((roomId: string) => timelines.get(roomId) ?? []),
    matrixEventsMock: {
      on: vi.fn(),
      off: vi.fn(),
    },
    paginateBackMock: vi.fn().mockResolvedValue(false),
    relationSummariesMock: vi.fn(() => ({
      reactionsByEventId: new Map(),
      threadReplyCountsByEventId: new Map(),
    })),
    sendReadReceiptMock: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('@matrix/index', () => ({
  getReadMarkerEventId: getReadMarkerEventIdMock,
  getTimeline: getTimelineMock,
  getTimelineRelationSummaries: relationSummariesMock,
  matrixEvents: matrixEventsMock,
  paginateBack: paginateBackMock,
  sendReadReceipt: sendReadReceiptMock,
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ replace: vi.fn() }),
}))

class MockIntersectionObserver {
  observe = vi.fn()
  disconnect = vi.fn()
}

let resizeObserverCallback: ResizeObserverCallback | null = null

class MockResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeObserverCallback = callback
  }

  observe = vi.fn()
  disconnect = vi.fn()
}

function createEvent(id: string): MatrixEvent {
  return {
    getId: () => id,
  } as unknown as MatrixEvent
}

function setScrollerMetrics(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    value: scrollHeight,
  })
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
}

function setClampedScrollerMetrics(el: HTMLElement, scrollHeight: number, clientHeight: number) {
  let currentScrollHeight = scrollHeight
  let currentScrollTop = 0
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => currentScrollHeight,
  })
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    value: clientHeight,
  })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = Math.min(Math.max(0, value), Math.max(0, currentScrollHeight - clientHeight))
    },
  })

  return {
    setScrollHeight(value: number) {
      currentScrollHeight = value
      currentScrollTop = Math.min(currentScrollTop, Math.max(0, currentScrollHeight - clientHeight))
    },
    get maxScrollTop() {
      return Math.max(0, currentScrollHeight - clientHeight)
    },
  }
}

function setItemMetrics(el: Element, offsetTop: number, offsetHeight: number) {
  Object.defineProperty(el, 'offsetTop', {
    configurable: true,
    value: offsetTop,
  })
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    value: offsetHeight,
  })
}

const MessageGroupStub = defineComponent({
  name: 'MessageGroup',
  props: {
    events: {
      type: Array,
      required: true,
    },
  },
  setup(props) {
    return () => h('div', {}, (props.events as MatrixEvent[]).map(event =>
      h('div', { 'data-event-id': event.getId() }, event.getId()),
    ))
  },
})

describe('message list room switching', () => {
  it('finishes scroll restoration when the next room has an empty timeline', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-new')])
    timelines.set('!room-empty:localhost', [])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: true,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    expect((scrollerWrapper.element as HTMLElement).style.visibility).toBe('visible')

    store.setCurrentRoom('!room-empty:localhost')
    await nextTick()
    await flushPromises()
    await nextTick()

    expect((scrollerWrapper.element as HTMLElement).style.visibility).toBe('visible')
    expect(wrapper.findComponent({ name: 'ChannelWelcome' }).exists()).toBe(true)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('saves sticky-bottom state from the actual scroller position when switching away', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    const scroller = scrollerWrapper.element as HTMLElement
    setScrollerMetrics(scroller, 1000, 300)

    const firstItem = wrapper.find('[data-event-id="$a-old"]').element
    setItemMetrics(firstItem, 120, 80)

    scroller.scrollTop = 140
    await scrollerWrapper.trigger('wheel')
    await scrollerWrapper.trigger('scroll')

    scroller.scrollTop = 700
    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    await flushPromises()

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    await flushPromises()
    await nextTick()

    expect(scroller.scrollTop).toBe(700)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('keeps sticky-bottom after switching rooms while user scroll intent is still active', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    resizeObserverCallback = null
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    const scroller = scrollerWrapper.element as HTMLElement
    const metrics = setClampedScrollerMetrics(scroller, 1000, 300)
    const firstItem = wrapper.find('[data-event-id="$a-old"]').element
    setItemMetrics(firstItem, 120, 80)

    scroller.scrollTop = scroller.scrollHeight
    await scrollerWrapper.trigger('wheel')
    await scrollerWrapper.trigger('scroll')
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    await flushPromises()

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    await flushPromises()
    await nextTick()
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    metrics.setScrollHeight(1300)
    await scrollerWrapper.trigger('scroll')
    resizeObserverCallback?.([], {} as ResizeObserver)

    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('hides the old room before the next room messages are rendered', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()
    expect(wrapper.text()).toContain('$a-new')

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    expect((scrollerWrapper.element as HTMLElement).style.visibility).toBe('hidden')
    expect(wrapper.text()).toContain('$b-new')

    await flushPromises()
    await nextTick()

    expect((scrollerWrapper.element as HTMLElement).style.visibility).toBe('visible')
    expect(wrapper.text()).toContain('$b-new')

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('settles sticky-bottom restoration across the next layout frame', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    const rafCallbacks: FrameRequestCallback[] = []
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      rafCallbacks.push(callback)
      return rafCallbacks.length
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    const scroller = scrollerWrapper.element as HTMLElement
    const metrics = setClampedScrollerMetrics(scroller, 1000, 300)
    scroller.scrollTop = scroller.scrollHeight
    await scrollerWrapper.trigger('scroll')

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    await flushPromises()

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    await flushPromises()
    await nextTick()
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    metrics.setScrollHeight(1300)
    for (const callback of rafCallbacks.splice(0)) {
      callback(performance.now())
    }
    await nextTick()

    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('does not let stale pagination restore an old anchor after switching back to a sticky-bottom room', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    let resolvePaginate: ((loaded: boolean) => void) | null = null
    paginateBackMock.mockImplementationOnce(() => new Promise<boolean>((resolve) => {
      resolvePaginate = resolve
    }))
    timelines.clear()
    getTimelineMock.mockClear()

    timelines.set('!room-a:localhost', [createEvent('$a-old'), createEvent('$a-new')])
    timelines.set('!room-b:localhost', [createEvent('$b-new')])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    const scroller = scrollerWrapper.element as HTMLElement
    const metrics = setClampedScrollerMetrics(scroller, 1000, 300)
    const firstItem = wrapper.find('[data-event-id="$a-old"]').element
    setItemMetrics(firstItem, 0, 80)

    scroller.scrollTop = 10
    await scrollerWrapper.trigger('wheel')
    await scrollerWrapper.trigger('scroll')
    expect(paginateBackMock).toHaveBeenCalledWith('!room-a:localhost', 30)

    scroller.scrollTop = scroller.scrollHeight
    await scrollerWrapper.trigger('scroll')
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    store.setCurrentRoom('!room-b:localhost')
    await nextTick()
    await flushPromises()

    store.setCurrentRoom('!room-a:localhost')
    await nextTick()
    await flushPromises()
    await nextTick()
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    resolvePaginate?.(false)
    await flushPromises()
    await nextTick()

    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('jumps to bottom and returns to the previous message anchor', async () => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver)
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('CSS', { escape: (value: string) => value })
    timelines.clear()
    getTimelineMock.mockClear()
    paginateBackMock.mockClear()

    timelines.set('!room-a:localhost', [
      createEvent('$a-old'),
      createEvent('$a-middle'),
      createEvent('$a-new'),
    ])

    const store = useChatStore()
    store.setCurrentRoom('!room-a:localhost')

    const MessageList = (await import('@/features/chat/components/MessageList.vue')).default
    const wrapper = mount(MessageList, {
      global: {
        stubs: {
          ChannelWelcome: true,
          MessageGroup: MessageGroupStub,
          UserInfoPanel: true,
        },
      },
    })

    await nextTick()
    await flushPromises()

    const scrollerWrapper = wrapper.get('[data-testid="message-list-scroller"]')
    const scroller = scrollerWrapper.element as HTMLElement
    const metrics = setClampedScrollerMetrics(scroller, 1200, 300)
    const oldItem = wrapper.find('[data-event-id="$a-old"]').element
    const middleItem = wrapper.find('[data-event-id="$a-middle"]').element
    setItemMetrics(oldItem, 100, 100)
    setItemMetrics(middleItem, 500, 100)

    scroller.scrollTop = 130
    await scrollerWrapper.trigger('wheel')
    await scrollerWrapper.trigger('scroll')

    const jumpToBottom = wrapper.get('[data-testid="timeline-jump-to-bottom"]')
    await jumpToBottom.trigger('click')

    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)
    expect(wrapper.find('[data-testid="timeline-jump-to-previous"]').exists()).toBe(true)

    metrics.setScrollHeight(1500)
    resizeObserverCallback?.([], {} as ResizeObserver)
    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)

    await wrapper.get('[data-testid="timeline-jump-to-previous"]').trigger('click')

    expect(scroller.scrollTop).toBe(130)
    expect(wrapper.find('[data-testid="timeline-jump-to-previous"]').exists()).toBe(false)

    await wrapper.get('[data-testid="timeline-jump-to-bottom"]').trigger('click')

    expect(scroller.scrollTop).toBe(metrics.maxScrollTop)
    expect(wrapper.find('[data-testid="timeline-jump-to-previous"]').exists()).toBe(false)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
