import type { RoomSummary } from '@matrix/types'
import type { UnifiedInboxItem } from '../types/unifiedInbox'
import { getClient } from '@matrix/client'
import { getRoom, getRoomSummaries, matrixEvents } from '@matrix/index'
import { computed, getCurrentInstance, onMounted, ref, shallowRef } from 'vue'
import { useInboxStore } from '../stores/inboxStore'

const LISTENED_EVENTS = ['room.message', 'room.member', 'room.receipt'] as const
const RECOVERY_SYNC_STATES = new Set(['RECONNECTING', 'CATCHUP', 'PREPARED', 'SYNCING'])

const summaries = shallowRef<RoomSummary[]>([])
const isLoading = ref(true)
let listenersBound = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function scheduleRefresh() {
  if (debounceTimer)
    return
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    refreshNow()
  }, 80)
}

function refreshNow() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  summaries.value = getRoomSummaries()
  isLoading.value = false
}

function handleSyncState({ state }: { state: string }) {
  if (RECOVERY_SYNC_STATES.has(state)) {
    refreshNow()
    return
  }
  scheduleRefresh()
}

function getLatestEventMeta(roomId: string): { eventId: string, ts: number, sender?: string, body?: string } {
  const room = getRoom(roomId)
  const events = room?.getLiveTimeline().getEvents() ?? []
  const latest = events[events.length - 1]
  return {
    eventId: latest?.getId?.() || `${roomId}:latest`,
    ts: latest?.getTs?.() || 0,
    sender: latest?.getSender?.() || undefined,
    body: latest?.getContent?.()?.body || undefined,
  }
}

function includesMention(body: string | undefined, userId: string | undefined): boolean {
  if (!body || !userId)
    return false
  const localpart = userId.split(':')[0]?.replace('@', '')
  if (!localpart)
    return false
  return body.includes(`@${localpart}`) || body.includes(userId)
}

function toInboxItems(roomList: RoomSummary[], currentUserId?: string): UnifiedInboxItem[] {
  const items: UnifiedInboxItem[] = []

  for (const room of roomList) {
    const latest = getLatestEventMeta(room.roomId)
    const base = {
      roomId: room.roomId,
      roomName: room.name,
      eventId: latest.eventId,
      createdTs: latest.ts || room.lastMessageTs || 0,
      snippet: room.lastMessage,
      unreadCount: room.unreadCount,
      highlightCount: room.highlightCount,
    }

    if (room.highlightCount > 0) {
      items.push({
        ...base,
        id: `mention:${room.roomId}`,
        type: 'mention',
      })
    }

    if (room.unreadCount > 0 && (room.highlightCount > 0 || includesMention(latest.body, currentUserId))) {
      items.push({
        ...base,
        id: `priority-unread:${room.roomId}`,
        type: 'priority-unread',
      })
    }

    const replyNeeded = room.unreadCount > 0 && !!latest.sender && latest.sender !== currentUserId
    if (replyNeeded) {
      items.push({
        ...base,
        id: `reply-needed:${room.roomId}`,
        type: 'reply-needed',
      })
    }
  }

  return items.sort((a, b) => b.createdTs - a.createdTs)
}

export function useUnifiedInbox() {
  const store = useInboxStore()

  const bind = () => {
    if (!listenersBound) {
      listenersBound = true
      for (const evt of LISTENED_EVENTS)
        matrixEvents.on(evt, scheduleRefresh)
      matrixEvents.on('sync.state', handleSyncState)
    }
  }

  if (getCurrentInstance()) {
    onMounted(() => {
      bind()
      refreshNow()
    })
  }
  else {
    bind()
    refreshNow()
  }

  const allItems = computed(() => {
    const currentUserId = getClient().getUserId() || undefined
    return toInboxItems(summaries.value, currentUserId)
  })

  const items = computed(() => {
    let list = allItems.value.filter(item => !store.isProcessed(item.id))
    if (store.filter !== 'all')
      list = list.filter(item => item.type === store.filter)
    return list
  })

  const counts = computed(() => {
    const raw = allItems.value.filter(item => !store.isProcessed(item.id))
    return {
      all: raw.length,
      mention: raw.filter(item => item.type === 'mention').length,
      'priority-unread': raw.filter(item => item.type === 'priority-unread').length,
      'reply-needed': raw.filter(item => item.type === 'reply-needed').length,
    }
  })

  return {
    isLoading,
    items,
    allItems,
    counts,
    refresh: refreshNow,
  }
}

export function __resetUnifiedInboxForTests() {
  for (const evt of LISTENED_EVENTS)
    matrixEvents.off(evt, scheduleRefresh)
  matrixEvents.off('sync.state', handleSyncState)
  summaries.value = []
  isLoading.value = true
  listenersBound = false
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}
