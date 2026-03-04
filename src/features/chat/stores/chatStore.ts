import type { RoomSummary } from '@matrix/types'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export type ConversationFilter = 'all' | 'unread' | 'dm' | 'group'

export const useChatStore = defineStore('chat', () => {
  const currentRoomId = ref<string | null>(null)
  const searchQuery = ref('')
  const replyingTo = ref<any>(null)
  const editingEvent = ref<any>(null)

  // --- 会话管理状态 ---
  const pinnedRooms = reactive(new Set<string>())
  const mutedRooms = reactive(new Set<string>())
  const markedUnreadRooms = reactive(new Set<string>())
  const drafts = reactive(new Map<string, string>())
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
    if (selectedMessages.has(eventId))
      selectedMessages.delete(eventId)
    else selectedMessages.add(eventId)
  }
  function isMessageSelected(eventId: string) {
    return selectedMessages.has(eventId)
  }

  // --- Discord 风格：侧边面板 ---
  const activeSidePanel = ref<'threads' | 'search' | 'pinned' | 'starred' | 'members' | 'settings' | null>(null)

  function setActiveTab(_tab: string) {
    // No-op: tabs removed in Discord layout, kept for API compat
  }

  function toggleSidePanel(panel: 'threads' | 'search' | 'pinned' | 'starred' | 'members' | 'settings') {
    if (activeSidePanel.value === panel) {
      activeSidePanel.value = null
    }
    else {
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
  function setCurrentRoom(roomId: string | null) {
    currentRoomId.value = roomId
    replyingTo.value = null
    editingEvent.value = null
    activeSidePanel.value = null
    // 切换房间时清理多选状态
    exitMultiSelect()
    // 进入房间时清除手动标记未读
    if (roomId)
      markedUnreadRooms.delete(roomId)
  }

  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setReplyingTo(event: any) {
    editingEvent.value = null
    replyingTo.value = event
  }

  function setEditingEvent(event: any) {
    replyingTo.value = null
    editingEvent.value = event
  }

  function clearCompose() {
    replyingTo.value = null
    editingEvent.value = null
  }

  // --- Set toggle 辅助函数 ---
  function toggleSet(set: Set<string>, id: string) {
    set.has(id) ? set.delete(id) : set.add(id)
  }

  // --- 置顶 ---
  function togglePin(roomId: string) {
    toggleSet(pinnedRooms, roomId)
  }
  function isPinned(roomId: string) {
    return pinnedRooms.has(roomId)
  }

  // --- 免打扰 ---
  function toggleMute(roomId: string) {
    toggleSet(mutedRooms, roomId)
  }
  function isMuted(roomId: string) {
    return mutedRooms.has(roomId)
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
    }
    else {
      drafts.delete(roomId)
    }
  }

  function getDraft(roomId: string) {
    return drafts.get(roomId) || ''
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
    for (const r of rooms) {
      if (r.isPinned)
        pinnedRooms.add(r.roomId)
      if (r.isMuted)
        mutedRooms.add(r.roomId)
    }
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
    setSearchQuery,
    setReplyingTo,
    setEditingEvent,
    clearCompose,
    // 会话管理操作
    togglePin,
    isPinned,
    toggleMute,
    isMuted,
    toggleMarkedUnread,
    isMarkedUnread,
    setDraft,
    getDraft,
    setFilter,
    openContextMenu,
    closeContextMenu,
    // 服务端状态同步
    syncServerState,
    // 隐藏消息（仅对自己删除）
    hiddenMessages,
    hideMessage(eventId: string) { hiddenMessages.add(eventId) },
    isHidden(eventId: string) { return hiddenMessages.has(eventId) },
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
