import type { ChannelInfo, SpaceInfo } from '@/matrix/spaces'
import { Store } from '@tanstack/vue-store'
import { registerSessionSubscriber } from '@/auth/lifecycleEvents'
import { getClient } from '@/matrix/client'
import { matrixEvents } from '@/matrix/events'
import {
  buildChannelInfo,
  getCategoryChannels,
  getOrphanRooms,
  getSpaceHierarchy,
  getTopLevelSpaces,
  isVoiceChannel,
} from '@/matrix/spaces'

// ── Types ──

export interface ChannelTreeCategory {
  id: string // spaceId for real categories, '__uncategorized__' for virtual
  name: string
  channels: ChannelInfo[]
  order?: string
}

export interface VoiceConnection {
  channelId: string
  channelName: string
  serverId: string
}

const SERVER_ORDER_STORAGE_KEY = 'muon_server_order'

function loadServerOrder(): string[] {
  try {
    if (typeof localStorage?.getItem !== 'function') return []
    const raw = localStorage.getItem(SERVER_ORDER_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function saveServerOrder(order: string[]): void {
  try {
    if (typeof localStorage?.setItem === 'function')
      localStorage.setItem(SERVER_ORDER_STORAGE_KEY, JSON.stringify(order))
  } catch {
    /* persistence is best-effort */
  }
}

export interface ServerState {
  servers: SpaceInfo[]
  currentServerId: string | null
  serverOrder: string[]
  channelTree: ChannelTreeCategory[]
  currentChannelId: string | null
  collapsedCategories: Set<string>
  lastVisitedChannel: Map<string, string>
  voiceConnection: VoiceConnection | null
  isDmMode: boolean
  orphanChannels: ChannelInfo[]
}

function createInitialState(): ServerState {
  return {
    servers: [],
    currentServerId: null,
    serverOrder: loadServerOrder(),
    channelTree: [],
    currentChannelId: null,
    collapsedCategories: new Set<string>(),
    lastVisitedChannel: new Map<string, string>(),
    voiceConnection: null,
    isDmMode: false,
    orphanChannels: [],
  }
}

export const serverStore = new Store<ServerState>(createInitialState())

// ── Pure helpers ──

function buildChannelTree(serverId: string): ChannelTreeCategory[] {
  const { categories, uncategorizedChannels } = getSpaceHierarchy(serverId)
  const tree: ChannelTreeCategory[] = []

  if (uncategorizedChannels.length > 0) {
    const textChannels = uncategorizedChannels.filter((ch) => !ch.isVoice)
    const voiceChannels = uncategorizedChannels.filter((ch) => ch.isVoice)

    if (textChannels.length > 0) {
      tree.push({ id: '__text_channels__', name: '__text_channels__', channels: textChannels })
    }
    if (voiceChannels.length > 0) {
      tree.push({ id: '__voice_channels__', name: '__voice_channels__', channels: voiceChannels })
    }
  }

  for (const cat of categories) {
    tree.push({ id: cat.spaceId, name: cat.name, channels: getCategoryChannels(cat.spaceId), order: cat.order })
  }

  return tree
}

function sortServers(spaces: SpaceInfo[], order: string[]): SpaceInfo[] {
  const orderMap = new Map(order.map((id, idx) => [id, idx]))
  return [...spaces].sort((a, b) => {
    const aIdx = orderMap.get(a.spaceId) ?? Number.MAX_SAFE_INTEGER
    const bIdx = orderMap.get(b.spaceId) ?? Number.MAX_SAFE_INTEGER
    return aIdx - bIdx
  })
}

// ── Server list management ──

export function loadServers() {
  serverStore.setState((s) => ({
    ...s,
    servers: sortServers(getTopLevelSpaces(), s.serverOrder),
    orphanChannels: getOrphanRooms().map((room) => buildChannelInfo(room, null)),
  }))
}

export function loadOrphanRooms() {
  serverStore.setState((s) => ({
    ...s,
    orphanChannels: getOrphanRooms().map((room) => buildChannelInfo(room, null)),
  }))
}

export function setServerOrder(order: string[]) {
  saveServerOrder(order)
  serverStore.setState((s) => ({ ...s, serverOrder: order, servers: sortServers(getTopLevelSpaces(), order) }))
  loadOrphanRooms()
}

export function reorderServer(fromIndex: number, toIndex: number) {
  const ids = serverStore.state.servers.map((s) => s.spaceId)
  const [moved] = ids.splice(fromIndex, 1)
  ids.splice(toIndex, 0, moved)
  setServerOrder(ids)
}

export function loadChannelTree(serverId: string) {
  serverStore.setState((s) => ({ ...s, channelTree: buildChannelTree(serverId) }))
}

// ── Navigation ──

export function selectServer(serverId: string | null) {
  if (serverId === null) {
    serverStore.setState((s) => ({ ...s, isDmMode: true, currentServerId: null, channelTree: [] }))
    return
  }

  const tree = buildChannelTree(serverId)
  const lastChannel = serverStore.state.lastVisitedChannel.get(serverId)
  let nextChannelId = serverStore.state.currentChannelId
  if (lastChannel) {
    nextChannelId = lastChannel
  } else {
    for (const cat of tree) {
      const firstText = cat.channels.find((ch) => !ch.isVoice)
      if (firstText) {
        nextChannelId = firstText.roomId
        break
      }
    }
  }

  serverStore.setState((s) => ({
    ...s,
    isDmMode: false,
    currentServerId: serverId,
    channelTree: tree,
    currentChannelId: nextChannelId,
  }))
}

export function selectChannel(channelId: string) {
  serverStore.setState((s) => {
    const lastVisitedChannel = new Map(s.lastVisitedChannel)
    if (s.currentServerId) lastVisitedChannel.set(s.currentServerId, channelId)
    return { ...s, currentChannelId: channelId, lastVisitedChannel }
  })
}

// ── Category collapse ──

export function toggleCategory(categoryId: string) {
  serverStore.setState((s) => {
    const collapsedCategories = new Set(s.collapsedCategories)
    if (collapsedCategories.has(categoryId)) collapsedCategories.delete(categoryId)
    else collapsedCategories.add(categoryId)
    return { ...s, collapsedCategories }
  })
}

export function isCategoryCollapsed(categoryId: string): boolean {
  return serverStore.state.collapsedCategories.has(categoryId)
}

// ── Voice channel ──

export function setVoiceConnection(connection: VoiceConnection | null) {
  serverStore.setState((s) => ({ ...s, voiceConnection: connection }))
}

// ── Unread aggregation for server icons ──

export function getServerUnreadInfo(serverId: string) {
  let totalUnread = 0
  let totalHighlight = 0

  const { categories, uncategorizedChannels } = getSpaceHierarchy(serverId)
  for (const ch of uncategorizedChannels) {
    totalUnread += ch.unreadCount
    totalHighlight += ch.highlightCount
  }
  for (const cat of categories) {
    for (const ch of getCategoryChannels(cat.spaceId)) {
      totalUnread += ch.unreadCount
      totalHighlight += ch.highlightCount
    }
  }

  return { unreadCount: totalUnread, highlightCount: totalHighlight }
}

// ── Voice channel detection ──

export function isRoomVoiceChannel(roomId: string): boolean {
  const room = getClient().getRoom(roomId)
  if (!room) return false
  return isVoiceChannel(room)
}

// ── Event listeners for incremental updates ──

let eventsListening = false

function onSpaceUpdate({ spaceId }: { spaceId: string }) {
  loadServers()
  const { currentServerId, channelTree } = serverStore.state
  if (currentServerId === spaceId || channelTree.some((cat) => cat.id === spaceId)) {
    loadChannelTree(currentServerId!)
  }
}

function onSpaceMember() {
  loadServers()
}

function onRoomMember() {
  if (serverStore.state.currentServerId) loadChannelTree(serverStore.state.currentServerId)
}

export function startListening() {
  if (eventsListening) return
  eventsListening = true
  matrixEvents.on('space.update', onSpaceUpdate)
  matrixEvents.on('space.member', onSpaceMember)
  matrixEvents.on('room.member', onRoomMember)
}

export function stopListening() {
  if (!eventsListening) return
  matrixEvents.off('space.update', onSpaceUpdate)
  matrixEvents.off('space.member', onSpaceMember)
  matrixEvents.off('room.member', onRoomMember)
  eventsListening = false
}

/** Full cleanup for logout — stop listeners and reset all state. */
export function resetServerStore() {
  stopListening()
  serverStore.setState(() => ({ ...createInitialState(), serverOrder: loadServerOrder() }))
}

const unregisterServerStoreSessionSubscriber = registerSessionSubscriber({
  onSignIn: () => {
    loadServers()
    startListening()
  },
  onSignOut: () => {
    resetServerStore()
  },
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unregisterServerStoreSessionSubscriber()
  })
}
