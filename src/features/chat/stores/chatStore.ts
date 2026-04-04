import type { RoomSummary } from '@matrix/types'
import type { MatrixEvent } from 'matrix-js-sdk'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ConversationFilter = 'all' | 'unread' | 'dm' | 'group'
export type SidePanelType = 'threads' | 'search' | 'pinned' | 'starred' | 'members' | 'settings' | 'tasks' | 'knowledge'

export const useChatStore = defineStore('chat', () => {
  const currentRoomId = ref<string | null>(null)
  const searchQuery = ref('')
  const replyingTo = ref<MatrixEvent | null>(null)
  const editingEvent = ref<MatrixEvent | null>(null)

  // --- 会话管理状态 ---
  const pinnedRooms = ref(new Set<string>())
  const mutedRooms = ref(new Set<string>())
  const markedUnreadRooms = ref(new Set<string>())
  const drafts = ref(new Map<string, string>())
  const activeFilter = ref<ConversationFilter>('all')
  const hiddenMessages = ref(new Set<string>()) // 仅对自己隐藏的消息ID

  // --- 消息多选 ---
  const multiSelectMode = ref(false)
  const selectedMessages = ref(new Set<string>()) // eventId set

  function enterMultiSelect() {
    multiSelectMode.value = true
  }
  function exitMultiSelect() {
    multiSelectMode.value = false
    selectedMessages.value = new Set()
  }
  function toggleMessageSelection(eventId: string) {
    const next = new Set(selectedMessages.value)
    if (next.has(eventId))
      next.delete(eventId)
    else next.add(eventId)
    selectedMessages.value = next
  }
  function isMessageSelected(eventId: string) {
    return selectedMessages.value.has(eventId)
  }

  // --- Side panel ---
  const activeSidePanel = ref<SidePanelType | null>(null)

  function setActiveTab(_tab: string) {
    // No-op: tabs removed, kept for API compat
  }

  function toggleSidePanel(panel: SidePanelType) {
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
    if (roomId) {
      const next = new Set(markedUnreadRooms.value)
      next.delete(roomId)
      markedUnreadRooms.value = next
    }
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

  // --- Set toggle 辅助函数 ---
  function toggleRefSet(setRef: { value: Set<string> }, id: string) {
    const next = new Set(setRef.value)
    next.has(id) ? next.delete(id) : next.add(id)
    setRef.value = next
  }

  // --- 置顶 ---
  function togglePin(roomId: string) {
    toggleRefSet(pinnedRooms, roomId)
  }
  function isPinned(roomId: string) {
    return pinnedRooms.value.has(roomId)
  }

  // --- 免打扰 ---
  function toggleMute(roomId: string) {
    toggleRefSet(mutedRooms, roomId)
  }
  function isMuted(roomId: string) {
    return mutedRooms.value.has(roomId)
  }

  // --- 标记未读 ---
  function toggleMarkedUnread(roomId: string) {
    toggleRefSet(markedUnreadRooms, roomId)
  }
  function isMarkedUnread(roomId: string) {
    return markedUnreadRooms.value.has(roomId)
  }

  // --- 草稿 ---
  function setDraft(roomId: string, text: string) {
    const next = new Map(drafts.value)
    if (text.trim()) {
      next.set(roomId, text)
    }
    else {
      next.delete(roomId)
    }
    drafts.value = next
  }

  function getDraft(roomId: string) {
    return drafts.value.get(roomId) || ''
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
    pinnedRooms.value = new Set(rooms.filter(r => r.isPinned).map(r => r.roomId))
    mutedRooms.value = new Set(rooms.filter(r => r.isMuted).map(r => r.roomId))
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
    hideMessage(eventId: string) {
      const next = new Set(hiddenMessages.value)
      next.add(eventId)
      hiddenMessages.value = next
    },
    isHidden(eventId: string) { return hiddenMessages.value.has(eventId) },
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
