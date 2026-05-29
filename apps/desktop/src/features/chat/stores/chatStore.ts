import type { RoomSummary } from '@matrix/types'
import type { MatrixEvent } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'
import { fromSync, runDesktopSync } from '@/shared/lib/effect'

export type ConversationFilter = 'all' | 'unread' | 'dm' | 'group'
export type SidePanelType = 'threads' | 'search' | 'pinned' | 'starred' | 'members' | 'settings' | 'tasks' | 'knowledge'
export type SidebarPlacement = 'promote' | 'history' | 'preserve'

export interface ComposerMentionRequest {
  id: string
  label: string
}

export interface SidebarPreviewInput {
  name?: string
  avatar?: string
  dmUserId?: string
  dmUserAvatar?: string
  isDirect?: boolean
}

interface SetCurrentRoomOptions {
  sidebarPlacement?: SidebarPlacement
  sidebarPreview?: SidebarPreviewInput
}

export const useChatStore = defineStore('chat', () => {
  const currentRoomId = ref<string | null>(null)
  const searchQuery = ref('')
  const replyingTo = ref<MatrixEvent | null>(null)
  const editingEvent = ref<MatrixEvent | null>(null)

  // --- 会话管理状态 ---
  const pinnedRooms = reactive(new Set<string>())
  const pendingPinStates = reactive(new Map<string, boolean>())
  const mutedRooms = reactive(new Set<string>())
  // 定时免打扰：roomId -> 到期时间戳(ms)。永久免打扰不写条目；条目到期即视为不再免打扰。
  const muteExpiry = reactive(new Map<string, number>())
  const markedUnreadRooms = reactive(new Set<string>())
  const drafts = reactive(new Map<string, string>())
  const htmlDrafts = reactive(new Map<string, string>())
  const draftPreviews = reactive(new Map<string, string>())

  // --- 草稿持久化到 localStorage ---
  const DRAFTS_STORAGE_KEY = 'muon_chat_drafts'
  // 定时免打扰到期时间持久化（Matrix push rule 无到期概念，需客户端本地维护）
  const MUTE_EXPIRY_STORAGE_KEY = 'muon_chat_mute_expiry'

  function loadDraftsFromStorage() {
    runDesktopSync(loadDraftsFromStorageEffect())
  }

  function loadDraftsFromStorageEffect(): DesktopEffect<void> {
    return fromSync(() => {
      const userId = getClient().getUserId()
      if (!userId) return
      const key = `${DRAFTS_STORAGE_KEY}:${userId}`
      const stored = localStorage.getItem(key)
      if (!stored) return
      const parsed = JSON.parse(stored)
      for (const [roomId, entry] of Object.entries(parsed) as [
        string,
        { text?: string; html?: string; preview?: string },
      ][]) {
        if (entry?.text) drafts.set(roomId, entry.text)
        if (entry?.html) htmlDrafts.set(roomId, entry.html)
        if (entry?.preview) draftPreviews.set(roomId, entry.preview)
      }
    }).pipe(Effect.catchAll(() => Effect.void))
  }

  function persistDrafts() {
    runDesktopSync(persistDraftsEffect())
  }

  function persistDraftsEffect(): DesktopEffect<void> {
    return fromSync(() => {
      const userId = getClient().getUserId()
      if (!userId) return
      const key = `${DRAFTS_STORAGE_KEY}:${userId}`
      const allRoomIds = new Set([...drafts.keys(), ...htmlDrafts.keys(), ...draftPreviews.keys()])
      if (allRoomIds.size === 0) {
        localStorage.removeItem(key)
      } else {
        const data: Record<string, { text?: string; html?: string; preview?: string }> = {}
        for (const roomId of allRoomIds) {
          const text = drafts.get(roomId)
          const html = htmlDrafts.get(roomId)
          const preview = draftPreviews.get(roomId)
          if (text || html || preview) {
            data[roomId] = {}
            if (text) data[roomId].text = text
            if (html) data[roomId].html = html
            if (preview) data[roomId].preview = preview
          }
        }
        localStorage.setItem(key, JSON.stringify(data))
      }
    }).pipe(Effect.catchAll(() => Effect.void))
  }

  function loadMuteExpiry() {
    runDesktopSync(
      fromSync(() => {
        const userId = getClient().getUserId()
        if (!userId) return
        const stored = localStorage.getItem(`${MUTE_EXPIRY_STORAGE_KEY}:${userId}`)
        if (!stored) return
        const parsed = JSON.parse(stored) as Record<string, number>
        for (const [roomId, expiry] of Object.entries(parsed)) {
          if (typeof expiry === 'number' && Number.isFinite(expiry)) muteExpiry.set(roomId, expiry)
        }
      }).pipe(Effect.catchAll(() => Effect.void)),
    )
  }

  function persistMuteExpiry() {
    runDesktopSync(
      fromSync(() => {
        const userId = getClient().getUserId()
        if (!userId) return
        const key = `${MUTE_EXPIRY_STORAGE_KEY}:${userId}`
        if (muteExpiry.size === 0) {
          localStorage.removeItem(key)
          return
        }
        localStorage.setItem(key, JSON.stringify(Object.fromEntries(muteExpiry)))
      }).pipe(Effect.catchAll(() => Effect.void)),
    )
  }

  loadDraftsFromStorage()
  loadMuteExpiry()
  const pendingMentionRequests = reactive<ComposerMentionRequest[]>([])
  const sidebarPromotionTimes = reactive(new Map<string, number>())
  const sidebarPromotionPreviews = reactive(new Map<string, RoomSummary>())
  const activeFilter = ref<ConversationFilter>('all')
  const hiddenMessages = reactive(new Set<string>()) // 仅对自己隐藏的消息ID

  // --- 消息多选 ---
  const multiSelectMode = ref(false)
  const selectedMessages = reactive(new Set<string>()) // eventId set

  function enterMultiSelect() {
    multiSelectMode.value = true
  }
  function exitMultiSelect() {
    multiSelectMode.value = false
    selectedMessages.clear()
  }
  function toggleMessageSelection(eventId: string) {
    if (selectedMessages.has(eventId)) selectedMessages.delete(eventId)
    else selectedMessages.add(eventId)
  }
  function isMessageSelected(eventId: string) {
    return selectedMessages.has(eventId)
  }

  // --- Side panel ---
  const activeSidePanel = ref<SidePanelType | null>(null)

  function setActiveTab(_tab: string) {
    // No-op: tabs removed, kept for API compat
  }

  function toggleSidePanel(panel: SidePanelType) {
    if (activeSidePanel.value === panel) {
      activeSidePanel.value = null
    } else {
      activeSidePanel.value = panel
    }
  }

  function closeSidePanel() {
    activeSidePanel.value = null
  }

  // --- Thread ---
  const activeThreadId = ref<string | null>(null)
  function openThread(eventId: string) {
    activeThreadId.value = eventId
  }
  function closeThread() {
    activeThreadId.value = null
  }

  // --- 右键菜单状态 ---
  const contextMenu = ref<{
    roomId: string
    x: number
    y: number
  } | null>(null)

  // --- 基础操作 ---
  function setCurrentRoom(roomId: string | null, options: SetCurrentRoomOptions = {}) {
    currentRoomId.value = roomId
    replyingTo.value = null
    editingEvent.value = null
    activeSidePanel.value = null
    // 切换房间时清理多选状态
    exitMultiSelect()
    // 进入房间时清除手动标记未读
    if (roomId) markedUnreadRooms.delete(roomId)
    if (roomId && options.sidebarPlacement === 'promote') {
      activeFilter.value = 'all'
      searchQuery.value = ''
      const promotedAt = Date.now()
      sidebarPromotionTimes.set(roomId, promotedAt)
      sidebarPromotionPreviews.set(roomId, createSidebarPreview(roomId, promotedAt, options.sidebarPreview))
    }
  }

  function setCurrentRoomFromRoute(roomId: string | null) {
    setCurrentRoom(roomId)
  }

  function selectRoomFromHistory(roomId: string) {
    setCurrentRoom(roomId, { sidebarPlacement: 'history' })
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setReplyingTo(event: MatrixEvent | null) {
    editingEvent.value = null
    replyingTo.value = event
  }

  function setEditingEvent(event: MatrixEvent | null) {
    replyingTo.value = null
    editingEvent.value = event
  }

  function clearCompose() {
    replyingTo.value = null
    editingEvent.value = null
  }

  function requestMention(mention: ComposerMentionRequest) {
    pendingMentionRequests.push(mention)
  }

  function consumePendingMentionRequests() {
    return pendingMentionRequests.splice(0)
  }

  // --- Set toggle 辅助函数 ---
  function toggleSet(set: Set<string>, id: string) {
    set.has(id) ? set.delete(id) : set.add(id)
  }

  // --- 置顶 ---
  function applyPin(roomId: string, pinned: boolean) {
    if (pinned) pinnedRooms.add(roomId)
    else pinnedRooms.delete(roomId)
  }
  function setPin(roomId: string, pinned: boolean) {
    applyPin(roomId, pinned)
    pendingPinStates.set(roomId, pinned)
  }
  function togglePin(roomId: string) {
    const nextPinned = !isPinned(roomId)
    setPin(roomId, nextPinned)
    return nextPinned
  }
  function isPinned(roomId: string) {
    return pinnedRooms.has(roomId)
  }

  // --- 免打扰（支持定时） ---
  function toggleMute(roomId: string) {
    toggleSet(mutedRooms, roomId)
    if (!mutedRooms.has(roomId) && muteExpiry.delete(roomId)) persistMuteExpiry()
  }
  /** 到期时间戳已过（即定时免打扰已失效） */
  function isMuteExpired(roomId: string) {
    const expiry = muteExpiry.get(roomId)
    return expiry !== undefined && Date.now() >= expiry
  }
  function isMuted(roomId: string) {
    return mutedRooms.has(roomId) && !isMuteExpired(roomId)
  }
  /** 设置/清除某会话的免打扰到期时间；expiry 为 null 表示永久免打扰 */
  function setMuteExpiry(roomId: string, expiry: number | null) {
    if (expiry === null) muteExpiry.delete(roomId)
    else muteExpiry.set(roomId, expiry)
    persistMuteExpiry()
  }
  /**
   * 开启免打扰并设置到期（expiry 为 null 表示永久）。
   * 返回 true 表示该会话此前未免打扰、需要上层新增服务端 push rule。
   */
  function muteWithExpiry(roomId: string, expiry: number | null): boolean {
    const wasMuted = mutedRooms.has(roomId)
    if (!wasMuted) mutedRooms.add(roomId)
    setMuteExpiry(roomId, expiry)
    return !wasMuted
  }
  function getMuteExpiry(roomId: string): number | undefined {
    return muteExpiry.get(roomId)
  }
  /** 仍被本地标记为免打扰、但定时已到期的会话（供上层移除服务端 push rule） */
  function collectExpiredMutes(): string[] {
    return [...mutedRooms].filter((roomId) => isMuteExpired(roomId))
  }

  // --- 标记未读 ---
  function toggleMarkedUnread(roomId: string) {
    toggleSet(markedUnreadRooms, roomId)
  }
  function isMarkedUnread(roomId: string) {
    return markedUnreadRooms.has(roomId)
  }

  // --- 草稿 ---
  function setDraft(roomId: string, text: string) {
    if (text.trim()) {
      drafts.set(roomId, text)
    } else {
      drafts.delete(roomId)
    }
    persistDrafts()
  }

  function getDraft(roomId: string) {
    return drafts.get(roomId) || ''
  }

  function setDraftPreview(roomId: string, preview: string) {
    const value = preview.trim()
    if (value) {
      draftPreviews.set(roomId, value)
    } else {
      draftPreviews.delete(roomId)
    }
    persistDrafts()
  }

  function getDraftPreview(roomId: string) {
    return draftPreviews.get(roomId) || drafts.get(roomId) || ''
  }

  function setHtmlDraft(roomId: string, html: string) {
    if (html.trim()) {
      htmlDrafts.set(roomId, html)
    } else {
      htmlDrafts.delete(roomId)
    }
    persistDrafts()
  }

  function getHtmlDraft(roomId: string) {
    return htmlDrafts.get(roomId) || ''
  }

  function clearAllDrafts(roomId: string) {
    drafts.delete(roomId)
    htmlDrafts.delete(roomId)
    draftPreviews.delete(roomId)
    persistDrafts()
  }

  function getSidebarPromotionTime(roomId: string) {
    return sidebarPromotionTimes.get(roomId)
  }

  function getSidebarPromotionRoomIds() {
    return [...sidebarPromotionTimes.keys()]
  }

  function getSidebarPromotionPreview(roomId: string) {
    return sidebarPromotionPreviews.get(roomId)
  }

  function clearSidebarPromotions() {
    sidebarPromotionTimes.clear()
    sidebarPromotionPreviews.clear()
  }

  function createSidebarPreview(roomId: string, promotedAt: number, preview: SidebarPreviewInput = {}): RoomSummary {
    const isDirect = preview.isDirect ?? !!preview.dmUserId

    return {
      roomId,
      name: preview.name || preview.dmUserId?.split(':')[0]?.slice(1) || roomId,
      avatar: preview.avatar,
      lastMessageTs: promotedAt,
      unreadCount: 0,
      isDirect,
      isEncrypted: false,
      members: preview.dmUserId ? [preview.dmUserId] : [],
      dmUserId: preview.dmUserId,
      dmUserAvatar: preview.dmUserAvatar || preview.avatar,
      isPinned: false,
      isMuted: false,
      highlightCount: 0,
      memberCount: isDirect ? 2 : 0,
    }
  }

  // --- 筛选 ---
  function setFilter(filter: ConversationFilter) {
    activeFilter.value = filter
  }

  // --- 右键菜单 ---
  function openContextMenu(roomId: string, x: number, y: number) {
    contextMenu.value = { roomId, x, y }
  }

  function closeContextMenu() {
    contextMenu.value = null
  }

  // --- 从服务端同步 pin/mute 状态 ---
  function syncServerState(rooms: RoomSummary[]) {
    pinnedRooms.clear()
    mutedRooms.clear()
    const serverMutedRoomIds = new Set<string>()
    for (const r of rooms) {
      const pendingPin = pendingPinStates.get(r.roomId)
      const isPinned = pendingPin ?? r.isPinned
      if (pendingPin !== undefined && pendingPin === r.isPinned) pendingPinStates.delete(r.roomId)

      if (isPinned) pinnedRooms.add(r.roomId)
      if (r.isMuted) {
        mutedRooms.add(r.roomId)
        serverMutedRoomIds.add(r.roomId)
      }
    }
    // 服务端已取消免打扰的会话，清除残留的到期记录
    let expiryChanged = false
    for (const roomId of [...muteExpiry.keys()]) {
      if (!serverMutedRoomIds.has(roomId)) {
        muteExpiry.delete(roomId)
        expiryChanged = true
      }
    }
    if (expiryChanged) persistMuteExpiry()
  }

  return {
    // 基础状态
    currentRoomId,
    searchQuery,
    replyingTo,
    editingEvent,
    // 会话管理状态
    activeFilter,
    // 右键菜单
    contextMenu,
    // 基础操作
    setCurrentRoom,
    setCurrentRoomFromRoute,
    selectRoomFromHistory,
    setSearchQuery,
    setReplyingTo,
    setEditingEvent,
    clearCompose,
    requestMention,
    consumePendingMentionRequests,
    // 会话管理操作
    setPin,
    togglePin,
    isPinned,
    toggleMute,
    isMuted,
    setMuteExpiry,
    muteWithExpiry,
    getMuteExpiry,
    collectExpiredMutes,
    toggleMarkedUnread,
    isMarkedUnread,
    setDraft,
    getDraft,
    setDraftPreview,
    getDraftPreview,
    setHtmlDraft,
    getHtmlDraft,
    clearAllDrafts,
    pendingMentionRequests,
    getSidebarPromotionTime,
    getSidebarPromotionRoomIds,
    getSidebarPromotionPreview,
    clearSidebarPromotions,
    setFilter,
    openContextMenu,
    closeContextMenu,
    // 服务端状态同步
    syncServerState,
    // 隐藏消息（仅对自己删除）
    hiddenMessages,
    hideMessage(eventId: string) {
      hiddenMessages.add(eventId)
    },
    isHidden(eventId: string) {
      return hiddenMessages.has(eventId)
    },
    // 消息多选
    multiSelectMode,
    selectedMessages,
    enterMultiSelect,
    exitMultiSelect,
    toggleMessageSelection,
    isMessageSelected,
    // Thread
    activeThreadId,
    openThread,
    closeThread,
    // 飞书风格 Tab & 侧边面板
    activeSidePanel,
    setActiveTab,
    toggleSidePanel,
    closeSidePanel,
  }
})
