import type { RoomSummary } from '@matrix/types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getRoomSummaries, invalidateRoomSummariesCache, matrixEvents, paginateBack, syncState } from '@matrix/index'
import { Effect } from 'effect'
import { computed, onMounted, ref, shallowRef } from 'vue'
import { registerSessionSubscriber } from '@/auth/lifecycleEvents'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { useChatStore } from '../stores/chatStore'

const LISTENED_EVENTS = [
  'room.message',
  'room.timeline',
  'room.decrypted',
  'room.member',
  'sync.state',
  'room.receipt',
] as const
const PREVIEW_HYDRATION_LIMIT = 30
const PREVIEW_HYDRATION_MAX_CONCURRENT = 3
const PREVIEW_HYDRATION_SYNC_STATES = new Set(['CATCHUP', 'PREPARED', 'SYNCING'])
type RefreshMode = 'resort' | 'preserve-order'
const REFRESH_EVENT_MODES: Record<(typeof LISTENED_EVENTS)[number], RefreshMode> = {
  'room.message': 'resort',
  'room.timeline': 'preserve-order',
  'room.decrypted': 'preserve-order',
  'room.member': 'preserve-order',
  'sync.state': 'preserve-order',
  'room.receipt': 'preserve-order',
}

// --- 持久化归档的 DM 房间 ---
const ARCHIVED_KEY = 'muon_archived_dms'

function loadArchivedDms(): Set<string> {
  return runDesktopSync(loadArchivedDmsEffect())
}

function loadArchivedDmsEffect(): DesktopEffect<Set<string>> {
  return fromSync(() => {
    const raw = localStorage.getItem(ARCHIVED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    const roomIds = Array.isArray(parsed) ? parsed.filter((roomId): roomId is string => typeof roomId === 'string') : []
    return new Set(roomIds)
  }).pipe(Effect.catchAll(() => Effect.succeed(new Set<string>())))
}

function saveArchivedDms(ids: Set<string>) {
  runDesktopSync(saveArchivedDmsEffect(ids))
}

function saveArchivedDmsEffect(ids: Set<string>): DesktopEffect<void> {
  return fromSync(() => localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...ids]))).pipe(Effect.asVoid)
}

function reloadArchivedDms(ids: Set<string>) {
  ids.clear()
  for (const roomId of loadArchivedDms()) ids.add(roomId)
}

// --- 模块级共享状态，所有组件实例共用同一份数据 ---
const rooms = shallowRef<RoomSummary[]>([])
const isLoading = ref(true)
const excludedRoomIds = new Set<string>()
const archivedDmIds = loadArchivedDms()
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let listenersBound = false
let pendingRefreshMode: RefreshMode | null = null
let historicalRoomOrder: string[] = []
let activePreviewHydrations = 0
let previewHydrationGeneration = 0
const pendingPreviewHydrationRoomIds = new Set<string>()
const hydratingPreviewRoomIds = new Set<string>()
const exhaustedPreviewHydrationRoomIds = new Set<string>()
const preloadedHistoryRoomIds = new Set<string>()

function mergeRefreshMode(current: RefreshMode | null, next: RefreshMode): RefreshMode {
  return current === 'resort' || next === 'resort' ? 'resort' : 'preserve-order'
}

function appendUnknownRoomsToHistory(next: RoomSummary[]) {
  const knownRoomIds = new Set(historicalRoomOrder)
  for (const room of next) {
    if (!knownRoomIds.has(room.roomId)) {
      historicalRoomOrder.push(room.roomId)
      knownRoomIds.add(room.roomId)
    }
  }
}

function updateHistoricalRoomOrder(next: RoomSummary[], mode: RefreshMode) {
  if (historicalRoomOrder.length === 0 || mode === 'resort') {
    const nextRoomIds = next.map((room) => room.roomId)
    const nextRoomIdSet = new Set(nextRoomIds)
    historicalRoomOrder = [...nextRoomIds, ...historicalRoomOrder.filter((roomId) => !nextRoomIdSet.has(roomId))]
    return
  }

  appendUnknownRoomsToHistory(next)
}

function preserveSummaryOrder(next: RoomSummary[]): RoomSummary[] {
  if (historicalRoomOrder.length === 0) return next

  const historicalIndexByRoomId = new Map(historicalRoomOrder.map((roomId, index) => [roomId, index]))
  const nextIndexByRoomId = new Map(next.map((room, index) => [room.roomId, index]))
  return [...next].sort((a, b) => {
    const previousA = historicalIndexByRoomId.get(a.roomId)
    const previousB = historicalIndexByRoomId.get(b.roomId)

    if (previousA !== undefined && previousB !== undefined) return previousA - previousB
    if (previousA !== undefined) return -1
    if (previousB !== undefined) return 1

    return (nextIndexByRoomId.get(a.roomId) ?? 0) - (nextIndexByRoomId.get(b.roomId) ?? 0)
  })
}

function orderBySidebarPromotion(
  list: RoomSummary[],
  getPromotionTime: (roomId: string) => number | undefined,
): RoomSummary[] {
  const originalIndexByRoomId = new Map(list.map((room, index) => [room.roomId, index]))

  return [...list].sort((a, b) => {
    const promotedAtA = getPromotionTime(a.roomId)
    const promotedAtB = getPromotionTime(b.roomId)

    if (promotedAtA !== undefined && promotedAtB !== undefined && promotedAtA !== promotedAtB)
      return promotedAtB - promotedAtA
    if (promotedAtA !== undefined && promotedAtB === undefined) return -1
    if (promotedAtA === undefined && promotedAtB !== undefined) return 1

    return (originalIndexByRoomId.get(a.roomId) ?? 0) - (originalIndexByRoomId.get(b.roomId) ?? 0)
  })
}

function mergeSidebarPromotionPreviews(list: RoomSummary[], store: ReturnType<typeof useChatStore>): RoomSummary[] {
  const knownRoomIds = new Set(list.map((room) => room.roomId))
  const previews = store
    .getSidebarPromotionRoomIds()
    .filter((roomId) => !knownRoomIds.has(roomId))
    .map((roomId) => store.getSidebarPromotionPreview(roomId))
    .filter((room): room is RoomSummary => !!room)

  return previews.length > 0 ? [...previews, ...list] : list
}

function scheduleRefresh(mode: RefreshMode = 'resort') {
  pendingRefreshMode = mergeRefreshMode(pendingRefreshMode, mode)
  if (debounceTimer) return
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    const refreshMode = pendingRefreshMode ?? 'resort'
    pendingRefreshMode = null
    refreshNow(refreshMode)
  }, 80)
}

const refreshEventHandlers: Record<(typeof LISTENED_EVENTS)[number], () => void> = {
  'room.message': () => scheduleRefresh(REFRESH_EVENT_MODES['room.message']),
  'room.timeline': () => scheduleRefresh(REFRESH_EVENT_MODES['room.timeline']),
  'room.decrypted': () => scheduleRefresh(REFRESH_EVENT_MODES['room.decrypted']),
  'room.member': () => scheduleRefresh(REFRESH_EVENT_MODES['room.member']),
  'sync.state': () => scheduleRefresh(REFRESH_EVENT_MODES['sync.state']),
  'room.receipt': () => scheduleRefresh(REFRESH_EVENT_MODES['room.receipt']),
}

function bindConversationsListeners() {
  if (listenersBound) return

  listenersBound = true
  for (const evt of LISTENED_EVENTS) matrixEvents.on(evt, refreshEventHandlers[evt])
}

function refreshNow(mode: RefreshMode = 'resort') {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  pendingRefreshMode = null
  invalidateRoomSummariesCache()
  let summaries = getRoomSummaries()
  // 过滤掉已退出但 sync 尚未确认的房间
  if (excludedRoomIds.size > 0) {
    summaries = summaries.filter((r) => !excludedRoomIds.has(r.roomId))
    // 清理已被 getRoomSummaries 的 membership 过滤自然排除的房间
    for (const rid of [...excludedRoomIds]) {
      if (!summaries.some((r) => r.roomId === rid)) {
        excludedRoomIds.delete(rid)
      }
    }
  }
  // 过滤掉已归档的 DM 房间
  if (archivedDmIds.size > 0) {
    summaries = summaries.filter((r) => !archivedDmIds.has(r.roomId))
  }
  updateHistoricalRoomOrder(summaries, mode)
  if (mode === 'preserve-order') summaries = preserveSummaryOrder(summaries)
  rooms.value = summaries
  isLoading.value = false
  // 将服务端 pin/mute 状态同步到 chatStore
  runDesktopSync(syncServerStateEffect(summaries))
  hydrateMissingPreviews(summaries)
}

function syncServerStateEffect(summaries: RoomSummary[]): DesktopEffect<void> {
  return fromSync(() => {
    const store = useChatStore()
    store.syncServerState(summaries)
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
}

function shouldHydratePreview(room: RoomSummary): boolean {
  return (
    !pendingPreviewHydrationRoomIds.has(room.roomId) &&
    !hydratingPreviewRoomIds.has(room.roomId) &&
    !exhaustedPreviewHydrationRoomIds.has(room.roomId) &&
    !preloadedHistoryRoomIds.has(room.roomId)
  )
}

function hydrateMissingPreviews(summaries: RoomSummary[]) {
  if (!PREVIEW_HYDRATION_SYNC_STATES.has(syncState.value)) return

  for (const room of summaries) {
    if (shouldHydratePreview(room)) pendingPreviewHydrationRoomIds.add(room.roomId)
  }
  drainPreviewHydrationQueue()
}

function drainPreviewHydrationQueue() {
  while (activePreviewHydrations < PREVIEW_HYDRATION_MAX_CONCURRENT && pendingPreviewHydrationRoomIds.size > 0) {
    const roomId = pendingPreviewHydrationRoomIds.values().next().value
    if (!roomId) return
    pendingPreviewHydrationRoomIds.delete(roomId)
    void hydrateRoomPreview(roomId)
  }
}

function hydrateRoomPreview(roomId: string): Promise<void> {
  const generation = previewHydrationGeneration
  activePreviewHydrations++
  hydratingPreviewRoomIds.add(roomId)

  return runDesktopEffect(hydrateRoomPreviewEffect(roomId, generation))
}

function hydrateRoomPreviewEffect(roomId: string, generation: number): DesktopEffect<void> {
  let paginationCompleted = false

  return Effect.gen(function* () {
    const loaded = yield* fromPromise(() => paginateBack(roomId, PREVIEW_HYDRATION_LIMIT))
    paginationCompleted = true
    if (generation !== previewHydrationGeneration) return

    yield* fromSync(() => {
      if (!loaded) {
        exhaustedPreviewHydrationRoomIds.add(roomId)
        preloadedHistoryRoomIds.add(roomId)
      } else {
        pendingPreviewHydrationRoomIds.add(roomId)
      }
    })
  }).pipe(
    Effect.catchAll((error) =>
      fromSync(() => {
        console.warn('[useConversations] Failed to hydrate conversation preview:', error)
      }),
    ),
    Effect.ensuring(
      Effect.sync(() => {
        if (generation !== previewHydrationGeneration) return
        hydratingPreviewRoomIds.delete(roomId)
        activePreviewHydrations--
        drainPreviewHydrationQueue()
      }),
    ),
    Effect.flatMap(() => {
      if (generation !== previewHydrationGeneration || !paginationCompleted) return Effect.succeed(undefined)
      return fromSync(() => refreshNow('preserve-order'))
    }),
  )
}

/** 立即从列表中移除指定房间（不等待 sync 确认） */
function removeRoom(roomId: string) {
  excludedRoomIds.add(roomId)
  rooms.value = rooms.value.filter((r) => r.roomId !== roomId)
}

/** 归档 DM 房间：从列表中隐藏但不离开房间（持久化，保留历史消息） */
function archiveDm(roomId: string) {
  archivedDmIds.add(roomId)
  saveArchivedDms(archivedDmIds)
  rooms.value = rooms.value.filter((r) => r.roomId !== roomId)
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
 * - 排序：搜索/联系人入口进入的会话优先，其次置顶会话，普通会话保持 getRoomSummaries 的历史顺序
 * - 筛选：all / unread / dm / group
 * - 搜索同时匹配房间名和最近消息
 */
export function useConversations() {
  const store = useChatStore()

  onMounted(() => {
    bindConversationsListeners()
    refreshNow()
  })

  // --- 筛选 + 搜索 + 置顶排序 ---
  const conversations = computed(() => {
    let list = mergeSidebarPromotionPreviews(rooms.value, store)

    // 筛选
    const filter = store.activeFilter
    if (filter === 'unread') {
      list = list.filter((r) => r.unreadCount > 0 || store.isMarkedUnread(r.roomId))
    } else if (filter === 'dm') {
      list = list.filter((r) => r.isDirect)
    } else if (filter === 'group') {
      list = list.filter((r) => !r.isDirect)
    }

    // 搜索
    const q = store.searchQuery.toLowerCase().trim()
    if (q) {
      list = list.filter(
        (r) => r.name.toLowerCase().includes(q) || (r.lastMessage && r.lastMessage.toLowerCase().includes(q)),
      )
    }

    const promoted = orderBySidebarPromotion(
      list.filter((r) => store.getSidebarPromotionTime(r.roomId) !== undefined),
      store.getSidebarPromotionTime,
    )
    const promotedIds = new Set(promoted.map((room) => room.roomId))
    const pinned = list.filter((r) => !promotedIds.has(r.roomId) && store.isPinned(r.roomId))
    const normal = list.filter((r) => !promotedIds.has(r.roomId) && !store.isPinned(r.roomId))
    return [...promoted, ...pinned, ...normal]
  })

  // 顶部连续置顶会话数量（用于列表分隔线定位）；搜索提升只调整排序，不形成独立分组。
  const pinnedCount = computed(() => {
    let count = 0
    for (const room of conversations.value) {
      if (!store.isPinned(room.roomId)) break
      count++
    }
    return count
  })

  // --- 总未读数（不受筛选/搜索影响，用于侧边栏角标） ---
  const totalUnreadCount = computed(() => rooms.value.reduce((sum, r) => sum + r.unreadCount, 0))

  return {
    conversations,
    pinnedCount,
    isLoading,
    totalUnreadCount,
    refresh: refreshNow,
    removeRoom,
    archiveDm,
    restoreRoom,
  }
}

/** Unbind module-level mitt listeners and reset state. Call on logout. */
export function resetConversationsListeners() {
  if (listenersBound) {
    for (const evt of LISTENED_EVENTS) matrixEvents.off(evt, refreshEventHandlers[evt])
    listenersBound = false
  }
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  pendingRefreshMode = null
  historicalRoomOrder = []
  activePreviewHydrations = 0
  previewHydrationGeneration++
  pendingPreviewHydrationRoomIds.clear()
  hydratingPreviewRoomIds.clear()
  exhaustedPreviewHydrationRoomIds.clear()
  preloadedHistoryRoomIds.clear()
  rooms.value = []
  isLoading.value = true
  excludedRoomIds.clear()
  archivedDmIds.clear()
  runDesktopSync(clearSidebarPromotionsEffect())
}

function clearSidebarPromotionsEffect(): DesktopEffect<void> {
  return fromSync(() => useChatStore().clearSidebarPromotions()).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
}

const unregisterConversationsSessionSubscriber = registerSessionSubscriber({
  onSignIn: () => {
    reloadArchivedDms(archivedDmIds)
    bindConversationsListeners()
    refreshNow()
  },
  onSignOut: resetConversationsListeners,
})

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unregisterConversationsSessionSubscriber()
  })
}
