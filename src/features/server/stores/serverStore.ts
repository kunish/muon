import type { ChannelInfo, SpaceInfo } from '@/matrix/spaces'
import { defineStore } from 'pinia'
import { reactive, ref, shallowRef } from 'vue'
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

// ── Store ──

export const useServerStore = defineStore('server', () => {
  // --- Server list ---
  const servers = shallowRef<SpaceInfo[]>([])
  const currentServerId = ref<string | null>(null)
  const serverOrder = ref<string[]>(
    JSON.parse(localStorage.getItem('muon_server_order') || '[]'),
  )

  // --- Channel tree for current server ---
  const channelTree = shallowRef<ChannelTreeCategory[]>([])
  const currentChannelId = ref<string | null>(null)
  const collapsedCategories = reactive(new Set<string>())

  // --- Per-server last visited channel ---
  const lastVisitedChannel = reactive(new Map<string, string>())

  // --- Voice ---
  const voiceConnection = ref<VoiceConnection | null>(null)

  // --- DM mode ---
  const isDmMode = ref(false)

  // --- Orphan rooms (not in any Space) ---
  const orphanChannels = shallowRef<ChannelInfo[]>([])

  // ── Server list management ──

  function loadServers() {
    const spaces = getTopLevelSpaces()
    // Sort by user-defined order, unordered spaces go to end
    const orderMap = new Map(serverOrder.value.map((id, idx) => [id, idx]))
    servers.value = spaces.sort((a, b) => {
      const aIdx = orderMap.get(a.spaceId) ?? Number.MAX_SAFE_INTEGER
      const bIdx = orderMap.get(b.spaceId) ?? Number.MAX_SAFE_INTEGER
      return aIdx - bIdx
    })

    // Also load orphan rooms
    loadOrphanRooms()
  }

  function loadOrphanRooms() {
    const rooms = getOrphanRooms()
    orphanChannels.value = rooms.map(room =>
      buildChannelInfo(room, null),
    )
  }

  function setServerOrder(order: string[]) {
    serverOrder.value = order
    localStorage.setItem('muon_server_order', JSON.stringify(order))
    loadServers() // re-sort
  }

  function reorderServer(fromIndex: number, toIndex: number) {
    const ids = servers.value.map(s => s.spaceId)
    const [moved] = ids.splice(fromIndex, 1)
    ids.splice(toIndex, 0, moved)
    setServerOrder(ids)
  }

  // ── Channel tree ──

  function loadChannelTree(serverId: string) {
    const { categories, uncategorizedChannels } = getSpaceHierarchy(serverId)
    const tree: ChannelTreeCategory[] = []

    // Uncategorized channels split into Discord-like sections
    if (uncategorizedChannels.length > 0) {
      const textChannels = uncategorizedChannels.filter(ch => !ch.isVoice)
      const voiceChannels = uncategorizedChannels.filter(ch => ch.isVoice)

      if (textChannels.length > 0) {
        tree.push({
          id: '__text_channels__',
          name: '__text_channels__',
          channels: textChannels,
        })
      }

      if (voiceChannels.length > 0) {
        tree.push({
          id: '__voice_channels__',
          name: '__voice_channels__',
          channels: voiceChannels,
        })
      }
    }

    // Then real categories
    for (const cat of categories) {
      const channels = getCategoryChannels(cat.spaceId)
      tree.push({
        id: cat.spaceId,
        name: cat.name,
        channels,
        order: cat.order,
      })
    }

    channelTree.value = tree
  }

  // ── Navigation ──

  function selectServer(serverId: string | null) {
    if (serverId === null) {
      // Switch to DM mode
      isDmMode.value = true
      currentServerId.value = null
      channelTree.value = []
      return
    }

    isDmMode.value = false
    currentServerId.value = serverId
    loadChannelTree(serverId)

    // Restore last visited channel
    const lastChannel = lastVisitedChannel.get(serverId)
    if (lastChannel) {
      currentChannelId.value = lastChannel
    }
    else {
      // Auto-select first text channel
      for (const cat of channelTree.value) {
        const firstText = cat.channels.find(ch => !ch.isVoice)
        if (firstText) {
          currentChannelId.value = firstText.roomId
          break
        }
      }
    }
  }

  function selectChannel(channelId: string) {
    currentChannelId.value = channelId
    if (currentServerId.value) {
      lastVisitedChannel.set(currentServerId.value, channelId)
    }
  }

  // ── Category collapse ──

  function toggleCategory(categoryId: string) {
    if (collapsedCategories.has(categoryId)) {
      collapsedCategories.delete(categoryId)
    }
    else {
      collapsedCategories.add(categoryId)
    }
  }

  function isCategoryCollapsed(categoryId: string) {
    return collapsedCategories.has(categoryId)
  }

  // ── Voice channel ──

  function setVoiceConnection(connection: VoiceConnection | null) {
    voiceConnection.value = connection
  }

  // ── Unread aggregation for server icons ──

  function getServerUnreadInfo(serverId: string) {
    let totalUnread = 0
    let totalHighlight = 0

    const { categories, uncategorizedChannels } = getSpaceHierarchy(serverId)
    for (const ch of uncategorizedChannels) {
      totalUnread += ch.unreadCount
      totalHighlight += ch.highlightCount
    }
    for (const cat of categories) {
      const channels = getCategoryChannels(cat.spaceId)
      for (const ch of channels) {
        totalUnread += ch.unreadCount
        totalHighlight += ch.highlightCount
      }
    }

    return { unreadCount: totalUnread, highlightCount: totalHighlight }
  }

  // ── Voice channel detection ──

  function isRoomVoiceChannel(roomId: string): boolean {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room)
      return false
    return isVoiceChannel(room)
  }

  // ── Event listeners for incremental updates ──

  let eventsListening = false

  function onSpaceUpdate({ spaceId }: { spaceId: string }) {
    // Refresh server list if a top-level space changed
    loadServers()
    // Refresh channel tree if current server's hierarchy changed
    if (currentServerId.value === spaceId || channelTree.value.some(cat => cat.id === spaceId)) {
      loadChannelTree(currentServerId.value!)
    }
  }

  function onSpaceMember() {
    // Refresh on membership changes
    loadServers()
  }

  function onRoomMember() {
    // Could affect member counts
    if (currentServerId.value) {
      loadChannelTree(currentServerId.value)
    }
  }

  function startListening() {
    if (eventsListening)
      return
    eventsListening = true

    matrixEvents.on('space.update', onSpaceUpdate)
    matrixEvents.on('space.member', onSpaceMember)
    matrixEvents.on('room.member', onRoomMember)
  }

  function stopListening() {
    if (!eventsListening)
      return
    matrixEvents.off('space.update', onSpaceUpdate)
    matrixEvents.off('space.member', onSpaceMember)
    matrixEvents.off('room.member', onRoomMember)
    eventsListening = false
  }

  return {
    // State
    servers,
    currentServerId,
    serverOrder,
    channelTree,
    currentChannelId,
    collapsedCategories,
    lastVisitedChannel,
    voiceConnection,
    isDmMode,
    orphanChannels,

    // Actions
    loadServers,
    loadOrphanRooms,
    setServerOrder,
    reorderServer,
    loadChannelTree,
    selectServer,
    selectChannel,
    toggleCategory,
    isCategoryCollapsed,
    setVoiceConnection,
    getServerUnreadInfo,
    isRoomVoiceChannel,
    startListening,
    stopListening,
  }
})
