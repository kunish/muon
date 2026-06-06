import type { RoomSummary } from '@/matrix/types'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { resetConversationsListeners, useConversations } from '@/features/chat/composables/useConversations'
import {
  chatStore,
  clearSidebarPromotions,
  resetChatStore,
  selectRoomFromHistory,
  setCurrentRoom,
  setCurrentRoomFromRoute,
  setFilter,
  setSearchQuery,
  syncServerState,
} from '@/features/chat/stores/chatStore'

const roomSummaries = vi.hoisted<RoomSummary[]>(() => [])
const matrixEventsOn = vi.hoisted(() => vi.fn())
const matrixEventsOff = vi.hoisted(() => vi.fn())
const matrixEventHandlers = vi.hoisted(() => new Map<string, Set<(...args: any[]) => void>>())
const invalidateRoomSummariesCacheMock = vi.hoisted(() => vi.fn())
const getTimelineMock = vi.hoisted(() => vi.fn())
const paginateBackMock = vi.hoisted(() => vi.fn())
const syncStateMock = vi.hoisted(() => ({ value: 'PREPARED' }))
const roomSummaryCacheState = vi.hoisted(() => ({
  enabled: false,
  cached: null as RoomSummary[] | null,
}))
const mountedWrappers: ReturnType<typeof mount>[] = []

vi.mock('@matrix/index', () => ({
  getRoomSummaries: () => {
    if (!roomSummaryCacheState.enabled) return roomSummaries.slice()

    if (!roomSummaryCacheState.cached) roomSummaryCacheState.cached = roomSummaries.slice()
    return roomSummaryCacheState.cached.slice()
  },
  getTimeline: getTimelineMock,
  invalidateRoomSummariesCache: () => {
    invalidateRoomSummariesCacheMock()
    roomSummaryCacheState.cached = null
  },
  paginateBack: paginateBackMock,
  syncState: syncStateMock,
  matrixEvents: {
    on: (event: string, handler: (...args: any[]) => void) => {
      matrixEventsOn(event, handler)
      const handlers = matrixEventHandlers.get(event) ?? new Set()
      handlers.add(handler)
      matrixEventHandlers.set(event, handlers)
    },
    off: (event: string, handler: (...args: any[]) => void) => {
      matrixEventsOff(event, handler)
      matrixEventHandlers.get(event)?.delete(handler)
    },
  },
}))

function createRoom(overrides: Partial<RoomSummary> = {}): RoomSummary {
  return {
    roomId: '!room:localhost',
    name: 'Room',
    lastMessage: 'hello',
    lastMessageTs: 0,
    unreadCount: 0,
    isDirect: true,
    isEncrypted: false,
    members: ['@tester:localhost'],
    isPinned: false,
    isMuted: false,
    highlightCount: 0,
    memberCount: 2,
    ...overrides,
  }
}

function mountUseConversationsHarness() {
  const wrapper = mount(
    defineComponent({
      name: 'UseConversationsHarness',
      setup() {
        const { conversations, pinnedCount } = useConversations()

        return () =>
          h(
            'ol',
            conversations.value.map((room, index) =>
              h(
                'li',
                {
                  'data-room-id': room.roomId,
                  'data-last-message': room.lastMessage,
                  'data-pinned-boundary': pinnedCount.value > 0 && index === pinnedCount.value ? 'true' : undefined,
                },
                room.name,
              ),
            ),
          )
      },
    }),
  )
  mountedWrappers.push(wrapper)
  return wrapper
}

describe('useConversations', () => {
  beforeEach(() => {
    resetConversationsListeners()
    localStorage.clear()
    roomSummaries.splice(0, roomSummaries.length)
    matrixEventsOn.mockClear()
    matrixEventsOff.mockClear()
    invalidateRoomSummariesCacheMock.mockClear()
    getTimelineMock.mockReset()
    getTimelineMock.mockReturnValue([])
    paginateBackMock.mockReset()
    paginateBackMock.mockResolvedValue(false)
    syncStateMock.value = 'PREPARED'
    matrixEventHandlers.clear()
    roomSummaryCacheState.enabled = false
    roomSummaryCacheState.cached = null
    vi.useRealTimers()
    resetChatStore()
    clearSidebarPromotions()
  })

  afterEach(() => {
    for (const wrapper of mountedWrappers.splice(0)) wrapper.unmount()
  })

  it('keeps history order when an existing conversation is opened outside the sidebar', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    setCurrentRoomFromRoute('!bob:localhost')

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
      '!bob:localhost',
    ])
  })

  it('keeps history order when the current room changes without sidebar promotion', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    setCurrentRoom('!bob:localhost')

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
      '!bob:localhost',
    ])
  })

  it('promotes a conversation opened from user search ahead of normal history', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    setCurrentRoomFromRoute('!bob:localhost')
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })

  it('keeps the searched contact first even when another conversation has a newer summary timestamp', async () => {
    const now = Date.now()
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: now + 10_000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: now + 5_000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: now - 10_000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })

  it('places a searched contact before pinned conversations', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000, isPinned: true }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 500 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    syncServerState(roomSummaries)
    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
    expect(wrapper.findAll('li').some((row) => row.attributes('data-pinned-boundary') === 'true')).toBe(false)
  })

  it('keeps the pinned boundary when pinned conversations remain the top group', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000, isPinned: true }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    syncServerState(roomSummaries)

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    const rows = wrapper.findAll('li')
    expect(rows.map((row) => row.attributes('data-room-id'))).toEqual(['!alice:localhost', '!bob:localhost'])
    expect(rows[1].attributes('data-pinned-boundary')).toBe('true')
  })

  it('shows a searched contact first before the new DM appears in room summaries', async () => {
    roomSummaries.push(createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }))

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    setCurrentRoom('!bob:localhost', {
      sidebarPlacement: 'promote',
      sidebarPreview: {
        name: 'Bob',
        dmUserId: '@bob:localhost',
        isDirect: true,
      },
    })
    await nextTick()

    const rows = wrapper.findAll('li')
    expect(rows.map((row) => row.attributes('data-room-id'))).toEqual(['!bob:localhost', '!alice:localhost'])
    expect(rows[0].text()).toBe('Bob')
  })

  it('shows a searched contact first when sidebar list search and filters were active', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000, unreadCount: 1 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    setFilter('unread')
    setSearchQuery('alice')
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual(['!alice:localhost'])

    setCurrentRoom('!bob:localhost', {
      sidebarPlacement: 'promote',
      sidebarPreview: {
        name: 'Bob',
        dmUserId: '@bob:localhost',
        isDirect: true,
      },
    })
    await nextTick()

    expect(chatStore.state.activeFilter).toBe('all')
    expect(chatStore.state.searchQuery).toBe('')
    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })

  it('keeps a searched contact first through immediate live message refreshes', async () => {
    vi.useFakeTimers()
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
    ])

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 4000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )
    for (const handler of matrixEventHandlers.get('room.message') ?? []) handler({ roomId: '!alice:localhost' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
    ])
  })

  it('does not promote history selections over a search-promoted conversation', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000 }),
    )

    setCurrentRoom('!bob:localhost', { sidebarPlacement: 'promote' })

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    selectRoomFromHistory('!alice:localhost')
    setCurrentRoomFromRoute('!alice:localhost')
    await nextTick()

    expect(chatStore.state.currentRoomId).toBe('!alice:localhost')
    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!bob:localhost',
      '!alice:localhost',
      '!carol:localhost',
    ])
  })

  it('keeps history order when a receipt refresh sees a hydrated room summary order', async () => {
    vi.useFakeTimers()
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 1000, unreadCount: 2 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(matrixEventHandlers.get('room.receipt')?.size).toBe(1)

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
      '!bob:localhost',
    ])

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 4000, unreadCount: 0 }),
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 2000 }),
    )

    for (const handler of matrixEventHandlers.get('room.receipt') ?? []) handler({ roomId: '!bob:localhost' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
      '!bob:localhost',
    ])
  })

  it('invalidates cached startup summaries before sync refreshes latest message previews', async () => {
    vi.useFakeTimers()
    roomSummaryCacheState.enabled = true
    roomSummaries.push(
      createRoom({
        roomId: '!alice:localhost',
        name: 'Alice',
        lastMessage: 'stale startup preview',
        lastMessageTs: 1000,
      }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.get('li').attributes('data-last-message')).toBe('stale startup preview')

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({
        roomId: '!alice:localhost',
        name: 'Alice',
        lastMessage: 'latest startup preview',
        lastMessageTs: 2000,
      }),
    )
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'PREPARED' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(invalidateRoomSummariesCacheMock).toHaveBeenCalled()
    expect(wrapper.get('li').attributes('data-last-message')).toBe('latest startup preview')
  })

  it('refreshes latest message previews when encrypted timeline events finish decrypting', async () => {
    vi.useFakeTimers()
    roomSummaries.push(
      createRoom({
        roomId: '!encrypted:localhost',
        name: 'Encrypted Room',
        lastMessage: undefined,
        lastMessageType: 'm.room.encrypted',
        lastMessageTs: 1000,
      }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(matrixEventHandlers.get('room.decrypted')?.size).toBe(1)
    expect(wrapper.get('li').attributes('data-last-message')).toBeUndefined()

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({
        roomId: '!encrypted:localhost',
        name: 'Encrypted Room',
        lastMessage: 'decrypted startup preview',
        lastMessageType: 'm.text',
        lastMessageTs: 1000,
      }),
    )
    for (const handler of matrixEventHandlers.get('room.decrypted') ?? []) handler({ roomId: '!encrypted:localhost' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(wrapper.get('li').attributes('data-last-message')).toBe('decrypted startup preview')
  })

  it('refreshes previews from non-live timeline updates without moving historical conversations', async () => {
    vi.useFakeTimers()
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessage: 'alice latest', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessage: undefined, lastMessageTs: 1000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(matrixEventHandlers.get('room.timeline')?.size).toBe(1)
    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!bob:localhost',
    ])
    expect(wrapper.findAll('li')[1].attributes('data-last-message')).toBeUndefined()

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({
        roomId: '!bob:localhost',
        name: 'Bob',
        lastMessage: 'bob loaded after timeline',
        lastMessageTs: 4000,
      }),
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessage: 'alice latest', lastMessageTs: 3000 }),
    )
    for (const handler of matrixEventHandlers.get('room.timeline') ?? []) handler({ roomId: '!bob:localhost' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    const rows = wrapper.findAll('li')
    expect(rows.map((row) => row.attributes('data-room-id'))).toEqual(['!alice:localhost', '!bob:localhost'])
    expect(rows[1].attributes('data-last-message')).toBe('bob loaded after timeline')
  })

  it('hydrates missing startup previews before a room is opened', async () => {
    let resolveHydration!: (loaded: boolean) => void
    paginateBackMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveHydration = resolve
        }),
    )
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessage: undefined, lastMessageTs: 1000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessage: 'bob latest', lastMessageTs: 900 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!alice:localhost', 30)
    expect(wrapper.findAll('li')[0].attributes('data-last-message')).toBeUndefined()

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({
        roomId: '!alice:localhost',
        name: 'Alice',
        lastMessage: 'alice hydrated latest',
        lastMessageTs: 1200,
      }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessage: 'bob latest', lastMessageTs: 900 }),
    )
    resolveHydration(true)
    await flushPromises()
    await nextTick()

    const rows = wrapper.findAll('li')
    expect(rows.map((row) => row.attributes('data-room-id'))).toEqual(['!alice:localhost', '!bob:localhost'])
    expect(rows[0].attributes('data-last-message')).toBe('alice hydrated latest')
  })

  it('refreshes sidebar previews when pagination reaches the final page after loading history', async () => {
    paginateBackMock.mockImplementationOnce(async () => {
      roomSummaries.splice(
        0,
        roomSummaries.length,
        createRoom({
          roomId: '!final-page:localhost',
          name: 'Final Page',
          lastMessage: 'loaded from final page',
          lastMessageTs: 1200,
        }),
      )
      return false
    })
    roomSummaries.push(
      createRoom({
        roomId: '!final-page:localhost',
        name: 'Final Page',
        lastMessage: undefined,
        lastMessageTs: undefined,
      }),
    )

    const wrapper = mountUseConversationsHarness()
    await flushPromises()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!final-page:localhost', 30)
    expect(wrapper.get('li').attributes('data-last-message')).toBe('loaded from final page')
  })

  it('waits for Matrix sync readiness before background preloading startup conversations', async () => {
    vi.useFakeTimers()
    syncStateMock.value = 'STOPPED'
    roomSummaries.push(
      createRoom({
        roomId: '!not-ready:localhost',
        name: 'Not Ready',
        lastMessage: undefined,
        lastMessageTs: undefined,
      }),
    )

    mountUseConversationsHarness()
    await flushPromises()

    expect(paginateBackMock).not.toHaveBeenCalled()

    syncStateMock.value = 'PREPARED'
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'PREPARED' })
    await vi.advanceTimersByTimeAsync(90)
    await flushPromises()

    expect(paginateBackMock).toHaveBeenCalledWith('!not-ready:localhost', 30)
  })

  it('hydrates blank startup summaries even when the initial sync has no timestamp or unread count', async () => {
    let resolveHydration!: (loaded: boolean) => void
    paginateBackMock.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveHydration = resolve
        }),
    )
    roomSummaries.push(
      createRoom({
        roomId: '!quiet-history:localhost',
        name: 'Quiet History',
        lastMessage: undefined,
        lastMessageTs: undefined,
        unreadCount: 0,
      }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!quiet-history:localhost', 30)
    expect(wrapper.get('li').attributes('data-last-message')).toBeUndefined()

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({
        roomId: '!quiet-history:localhost',
        name: 'Quiet History',
        lastMessage: 'quiet room history loaded',
        lastMessageTs: 1200,
      }),
    )
    resolveHydration(true)
    await flushPromises()
    await nextTick()

    expect(wrapper.get('li').attributes('data-last-message')).toBe('quiet room history loaded')
  })

  it('preloads the active room from the conversation startup queue as a fallback', async () => {
    setCurrentRoom('!active-history:localhost')
    roomSummaries.push(
      createRoom({
        roomId: '!active-history:localhost',
        name: 'Active History',
        lastMessage: undefined,
        lastMessageTs: undefined,
        unreadCount: 0,
      }),
    )

    mountUseConversationsHarness()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledWith('!active-history:localhost', 30)
  })

  it('preloads first history pages for all startup conversations, including the active one', async () => {
    const pendingHydrations = new Map<string, (loaded: boolean) => void>()
    paginateBackMock.mockImplementation(
      (roomId: string) =>
        new Promise<boolean>((resolve) => {
          pendingHydrations.set(roomId, resolve)
        }),
    )
    setCurrentRoom('!active:localhost')
    roomSummaries.push(
      createRoom({ roomId: '!active:localhost', name: 'Active', lastMessage: 'active latest', lastMessageTs: 4000 }),
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessage: 'alice latest', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessage: 'bob latest', lastMessageTs: 2000 }),
    )

    mountUseConversationsHarness()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledTimes(3)
    expect(paginateBackMock).toHaveBeenCalledWith('!active:localhost', 30)
    expect(paginateBackMock).toHaveBeenCalledWith('!alice:localhost', 30)
    expect(paginateBackMock).toHaveBeenCalledWith('!bob:localhost', 30)

    pendingHydrations.get('!active:localhost')?.(true)
    pendingHydrations.get('!alice:localhost')?.(true)
    pendingHydrations.get('!bob:localhost')?.(true)
    await flushPromises()
  })

  it('preloads beyond an already visible startup preview until server history is exhausted', async () => {
    getTimelineMock.mockImplementation(() => Array.from({ length: 50 }, (_, index) => ({ id: `$event-${index}` })))
    paginateBackMock.mockResolvedValueOnce(true).mockResolvedValueOnce(false)
    roomSummaries.push(
      createRoom({
        roomId: '!already-visible:localhost',
        name: 'Already Visible',
        lastMessage: 'latest',
        lastMessageTs: 5000,
      }),
    )

    mountUseConversationsHarness()
    await flushPromises()

    expect(paginateBackMock).toHaveBeenCalledTimes(2)
    expect(paginateBackMock).toHaveBeenNthCalledWith(1, '!already-visible:localhost', 30)
    expect(paginateBackMock).toHaveBeenNthCalledWith(2, '!already-visible:localhost', 30)
  })

  it('continues preloading a startup conversation until server history is exhausted', async () => {
    let visibleCount = 0
    getTimelineMock.mockImplementation(() =>
      Array.from({ length: visibleCount }, (_, index) => ({ id: `$event-${index}` })),
    )
    paginateBackMock
      .mockImplementationOnce(async () => {
        visibleCount = 10
        return true
      })
      .mockImplementationOnce(async () => {
        visibleCount = 50
        return true
      })
      .mockResolvedValueOnce(false)
    roomSummaries.push(
      createRoom({
        roomId: '!deep-history:localhost',
        name: 'Deep History',
        lastMessage: 'latest',
        lastMessageTs: 5000,
      }),
    )

    mountUseConversationsHarness()
    await flushPromises()

    expect(paginateBackMock).toHaveBeenCalledTimes(3)
    expect(paginateBackMock).toHaveBeenNthCalledWith(1, '!deep-history:localhost', 30)
    expect(paginateBackMock).toHaveBeenNthCalledWith(2, '!deep-history:localhost', 30)
    expect(paginateBackMock).toHaveBeenNthCalledWith(3, '!deep-history:localhost', 30)
  })

  it('continues preloading when visible timeline events still do not produce a sidebar preview', async () => {
    getTimelineMock.mockImplementation(() => Array.from({ length: 50 }, (_, index) => ({ id: `$system-${index}` })))
    let preloadAttempts = 0
    paginateBackMock.mockImplementation(async () => {
      preloadAttempts++
      if (preloadAttempts === 2) {
        roomSummaries.splice(
          0,
          roomSummaries.length,
          createRoom({
            roomId: '!system-heavy:localhost',
            name: 'System Heavy',
            lastMessage: 'first real message',
            lastMessageTs: 5000,
          }),
        )
      }
      return preloadAttempts < 2
    })
    roomSummaries.push(
      createRoom({
        roomId: '!system-heavy:localhost',
        name: 'System Heavy',
        lastMessage: undefined,
        lastMessageType: undefined,
        lastMessageTs: undefined,
      }),
    )

    const wrapper = mountUseConversationsHarness()
    await flushPromises()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledTimes(2)
    expect(wrapper.get('li').attributes('data-last-message')).toBe('first real message')
  })

  it('limits background history preloading concurrency and drains queued conversations', async () => {
    const pendingHydrations = new Map<string, (loaded: boolean) => void>()
    paginateBackMock.mockImplementation(
      (roomId: string) =>
        new Promise<boolean>((resolve) => {
          pendingHydrations.set(roomId, resolve)
        }),
    )
    roomSummaries.push(
      createRoom({ roomId: '!room-1:localhost', name: 'Room 1', lastMessage: 'one', lastMessageTs: 5000 }),
      createRoom({ roomId: '!room-2:localhost', name: 'Room 2', lastMessage: 'two', lastMessageTs: 4000 }),
      createRoom({ roomId: '!room-3:localhost', name: 'Room 3', lastMessage: 'three', lastMessageTs: 3000 }),
      createRoom({ roomId: '!room-4:localhost', name: 'Room 4', lastMessage: 'four', lastMessageTs: 2000 }),
    )

    mountUseConversationsHarness()
    await nextTick()

    expect(paginateBackMock).toHaveBeenCalledTimes(3)
    expect(paginateBackMock).toHaveBeenCalledWith('!room-1:localhost', 30)
    expect(paginateBackMock).toHaveBeenCalledWith('!room-2:localhost', 30)
    expect(paginateBackMock).toHaveBeenCalledWith('!room-3:localhost', 30)

    pendingHydrations.get('!room-1:localhost')?.(true)
    await flushPromises()

    expect(paginateBackMock).toHaveBeenCalledTimes(4)
    expect(paginateBackMock).toHaveBeenCalledWith('!room-4:localhost', 30)

    pendingHydrations.get('!room-2:localhost')?.(true)
    pendingHydrations.get('!room-3:localhost')?.(true)
    pendingHydrations.get('!room-4:localhost')?.(true)
    await flushPromises()
  })

  it('restores a temporarily missing known room to its history position instead of appending it', async () => {
    vi.useFakeTimers()
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 2000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 1000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!bob:localhost',
      '!carol:localhost',
    ])

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 1000 }),
    )
    for (const handler of matrixEventHandlers.get('sync.state') ?? []) handler({ state: 'SYNCING' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!carol:localhost',
    ])

    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 1000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 2000, unreadCount: 0 }),
    )
    for (const handler of matrixEventHandlers.get('room.receipt') ?? []) handler({ roomId: '!bob:localhost' })
    await vi.advanceTimersByTimeAsync(90)
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!bob:localhost',
      '!carol:localhost',
    ])
  })

  it('keeps a clicked sidebar conversation in its startup position when a later composable instance mounts', async () => {
    roomSummaries.push(
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 2000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 1000 }),
    )

    const wrapper = mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!bob:localhost',
      '!carol:localhost',
    ])

    selectRoomFromHistory('!bob:localhost')
    roomSummaries.splice(
      0,
      roomSummaries.length,
      createRoom({ roomId: '!alice:localhost', name: 'Alice', lastMessageTs: 3000 }),
      createRoom({ roomId: '!carol:localhost', name: 'Carol', lastMessageTs: 1000 }),
      createRoom({ roomId: '!bob:localhost', name: 'Bob', lastMessageTs: 2000, unreadCount: 0 }),
    )

    mountUseConversationsHarness()
    await nextTick()

    expect(wrapper.findAll('li').map((row) => row.attributes('data-room-id'))).toEqual([
      '!alice:localhost',
      '!bob:localhost',
      '!carol:localhost',
    ])
  })
})
