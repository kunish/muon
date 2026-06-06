import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isCategoryCollapsed,
  loadServers,
  reorderServer,
  resetServerStore,
  selectChannel,
  selectServer,
  serverStore,
  setServerOrder,
  toggleCategory,
} from '@/features/server/stores/serverStore'

const spacesMock = vi.hoisted(() => ({
  getTopLevelSpaces: vi.fn(() => [] as any[]),
  getOrphanRooms: vi.fn(() => [] as any[]),
  getSpaceHierarchy: vi.fn(() => ({ categories: [] as any[], uncategorizedChannels: [] as any[] })),
  getCategoryChannels: vi.fn(() => [] as any[]),
  buildChannelInfo: vi.fn((room: any) => ({ roomId: room.roomId })),
  isVoiceChannel: vi.fn(() => false),
}))

vi.mock('@/matrix/spaces', () => spacesMock)
vi.mock('@/matrix/client', () => ({ getClient: () => ({ getRoom: () => null }) }))
vi.mock('@/matrix/events', () => ({ matrixEvents: { on: vi.fn(), off: vi.fn() } }))
vi.mock('@/auth/lifecycleEvents', () => ({ registerSessionSubscriber: () => () => {} }))

function space(id: string) {
  return { spaceId: id, name: id }
}

function channel(roomId: string, isVoice = false) {
  return { roomId, name: roomId, isVoice, unreadCount: 0, highlightCount: 0 }
}

beforeEach(() => {
  localStorage.clear()
  resetServerStore()
  spacesMock.getTopLevelSpaces.mockReturnValue([])
  spacesMock.getOrphanRooms.mockReturnValue([])
  spacesMock.getSpaceHierarchy.mockReturnValue({ categories: [], uncategorizedChannels: [] })
  spacesMock.getCategoryChannels.mockReturnValue([])
})

describe('serverStore', () => {
  it('loadServers orders spaces by the saved server order', () => {
    spacesMock.getTopLevelSpaces.mockReturnValue([space('!b'), space('!a')])
    setServerOrder(['!a', '!b'])

    loadServers()

    expect(serverStore.state.servers.map((s) => s.spaceId)).toEqual(['!a', '!b'])
  })

  it('selectServer(null) switches to DM mode and clears the tree', () => {
    selectServer(null)
    expect(serverStore.state.isDmMode).toBe(true)
    expect(serverStore.state.currentServerId).toBeNull()
    expect(serverStore.state.channelTree).toEqual([])
  })

  it('selectServer auto-selects the first text channel when no last-visited exists', () => {
    spacesMock.getSpaceHierarchy.mockReturnValue({
      categories: [],
      uncategorizedChannels: [channel('!voice', true), channel('!text')],
    })

    selectServer('!server')

    expect(serverStore.state.currentServerId).toBe('!server')
    expect(serverStore.state.isDmMode).toBe(false)
    expect(serverStore.state.currentChannelId).toBe('!text')
  })

  it('selectChannel records the last visited channel for the current server', () => {
    spacesMock.getSpaceHierarchy.mockReturnValue({ categories: [], uncategorizedChannels: [channel('!text')] })
    selectServer('!server')

    selectChannel('!other')

    expect(serverStore.state.currentChannelId).toBe('!other')
    expect(serverStore.state.lastVisitedChannel.get('!server')).toBe('!other')
  })

  it('toggleCategory flips collapsed state', () => {
    expect(isCategoryCollapsed('!cat')).toBe(false)
    toggleCategory('!cat')
    expect(isCategoryCollapsed('!cat')).toBe(true)
    toggleCategory('!cat')
    expect(isCategoryCollapsed('!cat')).toBe(false)
  })

  it('reorderServer moves a server and persists the new order', () => {
    spacesMock.getTopLevelSpaces.mockReturnValue([space('!a'), space('!b'), space('!c')])
    loadServers()

    reorderServer(0, 2)

    expect(serverStore.state.serverOrder).toEqual(['!b', '!c', '!a'])
    expect(JSON.parse(localStorage.getItem('muon_server_order')!)).toEqual(['!b', '!c', '!a'])
  })

  it('resetServerStore clears navigation state', () => {
    selectServer(null)
    toggleCategory('!cat')
    resetServerStore()
    expect(serverStore.state.isDmMode).toBe(false)
    expect(serverStore.state.collapsedCategories.size).toBe(0)
  })
})
