import type { RoomSummary } from '@matrix/types'
import { getRoomSummaries, matrixEvents } from '@matrix/index'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useChatStore } from '../stores/chatStore'

const LISTENED_EVENTS = ['room.message', 'room.member', 'sync.state', 'room.receipt'] as const

// --- 持久化归档的 DM 房间 ---
const ARCHIVED_KEY = 'muon_archived_dms'

function loadArchivedDms(): Set<string> {
  try {
    const raw = localStorage.getItem(ARCHIVED_KEY)
    return new Set(raw ? JSON.parse(raw) : [])
  }
  catch {
    return new Set()
  }
}

function saveArchivedDms(ids: Set<string>) {
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...ids]))
}

// --- 模块级共享状态，所有组件实例共用同一份数据 ---
const rooms = shallowRef<RoomSummary[]>([])
const isLoading = ref(true)
const excludedRoomIds = new Set<string>()
const archivedDmIds = loadArchivedDms()
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false

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
  let summaries = getRoomSummaries()
  // 过滤掉已退出但 sync 尚未确认的房间
  if (excludedRoomIds.size > 0) {
    summaries = summaries.filter(r => !excludedRoomIds.has(r.roomId))
    // 清理已被 getRoomSummaries 的 membership 过滤自然排除的房间
    for (const rid of [...excludedRoomIds]) {
      if (!summaries.some(r => r.roomId === rid)) {
        excludedRoomIds.delete(rid)
      }
    }
  }
  // 过滤掉已归档的 DM 房间
  if (archivedDmIds.size > 0) {
    summaries = summaries.filter(r => !archivedDmIds.has(r.roomId))
  }
  rooms.value = summaries
  isLoading.value = false
  // 将服务端 pin/mute 状态同步到 chatStore
  try {
    const store = useChatStore()
    store.syncServerState(summaries)
  }
  catch { /* store 尚未初始化时忽略 */ }
}

/** 立即从列表中移除指定房间（不等待 sync 确认） */
function removeRoom(roomId: string) {
  excludedRoomIds.add(roomId)
  rooms.value = rooms.value.filter(r => r.roomId !== roomId)
}

/** 归档 DM 房间：从列表中隐藏但不离开房间（持久化，保留历史消息） */
function archiveDm(roomId: string) {
  archivedDmIds.add(roomId)
  saveArchivedDms(archivedDmIds)
  rooms.value = rooms.value.filter(r => r.roomId !== roomId)
}

/** 恢复被归档/隐藏的房间，使其重新出现在列表中 */
function restoreRoom(roomId: string) {
  let changed = false
  if (excludedRoomIds.has(roomId)) {
    excludedRoomIds.delete(roomId)
    changed = true
  }
  if (archivedDmIds.has(roomId)) {
    archivedDmIds.delete(roomId)
    saveArchivedDms(archivedDmIds)
    changed = true
  }
  if (changed) {
    refreshNow()
  }
}

/**
 * 会话列表数据源 composable
 * - 置顶排序：pinned 优先
 * - 筛选：all / unread / dm / group
 * - 搜索同时匹配房间名和最近消息
 */
export function useConversations() {
  const store = useChatStore()

  // 首次使用时绑定事件监听，全局只绑定一次
  onMounted(() => {
    if (!listenersBound) {
      listenersBound = true
      refreshNow()
      for (const evt of LISTENED_EVENTS)
        matrixEvents.on(evt, scheduleRefresh)
    }
  })

  // --- 筛选 + 搜索 + 置顶排序 ---
  const conversations = computed(() => {
    let list = rooms.value

    // 筛选
    const filter = store.activeFilter
    if (filter === 'unread') {
      list = list.filter(r => r.unreadCount > 0 || store.isMarkedUnread(r.roomId))
    }
    else if (filter === 'dm') {
      list = list.filter(r => r.isDirect)
    }
    else if (filter === 'group') {
      list = list.filter(r => !r.isDirect)
    }

    // 搜索
    const q = store.searchQuery.toLowerCase().trim()
    if (q) {
      list = list.filter(
        r =>
          r.name.toLowerCase().includes(q)
          || (r.lastMessage && r.lastMessage.toLowerCase().includes(q)),
      )
    }

    // 置顶排序：pinned 在前，各组内按时间倒序
    const pinned = list.filter(r => store.isPinned(r.roomId))
    const normal = list.filter(r => !store.isPinned(r.roomId))
    return [...pinned, ...normal]
  })

  // 当前筛选结果中的置顶数量（用于列表分隔线定位）
  const pinnedCount = computed(() =>
    conversations.value.filter(r => store.isPinned(r.roomId)).length,
  )

  // --- 总未读数（不受筛选/搜索影响，用于侧边栏角标） ---
  const totalUnreadCount = computed(() =>
    rooms.value.reduce((sum, r) => sum + r.unreadCount, 0),
  )

  return { conversations, pinnedCount, isLoading, totalUnreadCount, refresh: refreshNow, removeRoom, archiveDm, restoreRoom }
}
