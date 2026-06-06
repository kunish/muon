import type { RoomSummary } from '@matrix/types'
import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'
import { Store } from '@tanstack/vue-store'

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

interface ContextMenuState {
  roomId: string
  x: number
  y: number
}

const DRAFTS_STORAGE_KEY = 'muon_chat_drafts'
const MUTE_EXPIRY_STORAGE_KEY = 'muon_chat_mute_expiry'

export interface ChatState {
  currentRoomId: string | null
  searchQuery: string
  replyingTo: MatrixEvent | null
  editingEvent: MatrixEvent | null
  activeFilter: ConversationFilter
  contextMenu: ContextMenuState | null
  multiSelectMode: boolean
  activeSidePanel: SidePanelType | null
  activeThreadId: string | null
  pinnedRooms: Set<string>
  pendingPinStates: Map<string, boolean>
  mutedRooms: Set<string>
  muteExpiry: Map<string, number>
  markedUnreadRooms: Set<string>
  drafts: Map<string, string>
  htmlDrafts: Map<string, string>
  draftPreviews: Map<string, string>
  pendingMentionRequests: ComposerMentionRequest[]
  sidebarPromotionTimes: Map<string, number>
  sidebarPromotionPreviews: Map<string, RoomSummary>
  hiddenMessages: Set<string>
  selectedMessages: Set<string>
}

function loadDraftsFromStorage(): {
  drafts: Map<string, string>
  htmlDrafts: Map<string, string>
  draftPreviews: Map<string, string>
} {
  const drafts = new Map<string, string>()
  const htmlDrafts = new Map<string, string>()
  const draftPreviews = new Map<string, string>()
  try {
    const userId = getClient().getUserId()
    if (!userId) return { drafts, htmlDrafts, draftPreviews }
    const stored = localStorage.getItem(`${DRAFTS_STORAGE_KEY}:${userId}`)
    if (!stored) return { drafts, htmlDrafts, draftPreviews }
    const parsed = JSON.parse(stored) as Record<string, { text?: string; html?: string; preview?: string }>
    for (const [roomId, entry] of Object.entries(parsed)) {
      if (entry?.text) drafts.set(roomId, entry.text)
      if (entry?.html) htmlDrafts.set(roomId, entry.html)
      if (entry?.preview) draftPreviews.set(roomId, entry.preview)
    }
  } catch {
    /* best-effort hydrate */
  }
  return { drafts, htmlDrafts, draftPreviews }
}

function loadMuteExpiry(): Map<string, number> {
  const muteExpiry = new Map<string, number>()
  try {
    const userId = getClient().getUserId()
    if (!userId) return muteExpiry
    const stored = localStorage.getItem(`${MUTE_EXPIRY_STORAGE_KEY}:${userId}`)
    if (!stored) return muteExpiry
    const parsed = JSON.parse(stored) as Record<string, number>
    for (const [roomId, expiry] of Object.entries(parsed)) {
      if (typeof expiry === 'number' && Number.isFinite(expiry)) muteExpiry.set(roomId, expiry)
    }
  } catch {
    /* best-effort hydrate */
  }
  return muteExpiry
}

function persistDrafts(state: ChatState): void {
  try {
    const userId = getClient().getUserId()
    if (!userId) return
    const key = `${DRAFTS_STORAGE_KEY}:${userId}`
    const allRoomIds = new Set([...state.drafts.keys(), ...state.htmlDrafts.keys(), ...state.draftPreviews.keys()])
    if (allRoomIds.size === 0) {
      localStorage.removeItem(key)
      return
    }
    const data: Record<string, { text?: string; html?: string; preview?: string }> = {}
    for (const roomId of allRoomIds) {
      const text = state.drafts.get(roomId)
      const html = state.htmlDrafts.get(roomId)
      const preview = state.draftPreviews.get(roomId)
      if (text || html || preview) {
        data[roomId] = {}
        if (text) data[roomId].text = text
        if (html) data[roomId].html = html
        if (preview) data[roomId].preview = preview
      }
    }
    localStorage.setItem(key, JSON.stringify(data))
  } catch {
    /* best-effort persist */
  }
}

function persistMuteExpiry(state: ChatState): void {
  try {
    const userId = getClient().getUserId()
    if (!userId) return
    const key = `${MUTE_EXPIRY_STORAGE_KEY}:${userId}`
    if (state.muteExpiry.size === 0) {
      localStorage.removeItem(key)
      return
    }
    localStorage.setItem(key, JSON.stringify(Object.fromEntries(state.muteExpiry)))
  } catch {
    /* best-effort persist */
  }
}

function createInitialState(): ChatState {
  const { drafts, htmlDrafts, draftPreviews } = loadDraftsFromStorage()
  return {
    currentRoomId: null,
    searchQuery: '',
    replyingTo: null,
    editingEvent: null,
    activeFilter: 'all',
    contextMenu: null,
    multiSelectMode: false,
    activeSidePanel: null,
    activeThreadId: null,
    pinnedRooms: new Set(),
    pendingPinStates: new Map(),
    mutedRooms: new Set(),
    muteExpiry: loadMuteExpiry(),
    markedUnreadRooms: new Set(),
    drafts,
    htmlDrafts,
    draftPreviews,
    pendingMentionRequests: [],
    sidebarPromotionTimes: new Map(),
    sidebarPromotionPreviews: new Map(),
    hiddenMessages: new Set(),
    selectedMessages: new Set(),
  }
}

export const chatStore = new Store<ChatState>(createInitialState())

const set = (updater: (s: ChatState) => ChatState) => chatStore.setState(updater)

// ── Pure selectors for reactive component reads ──
export function selectIsPinned(roomId: string) {
  return (s: ChatState) => s.pinnedRooms.has(roomId)
}
export function selectIsMuted(roomId: string) {
  return (s: ChatState) => s.mutedRooms.has(roomId) && !isMuteExpiredIn(s, roomId)
}
export function selectIsMarkedUnread(roomId: string) {
  return (s: ChatState) => s.markedUnreadRooms.has(roomId)
}
export function selectIsMessageSelected(eventId: string) {
  return (s: ChatState) => s.selectedMessages.has(eventId)
}
export function selectIsHidden(eventId: string) {
  return (s: ChatState) => s.hiddenMessages.has(eventId)
}

// ── Basic ops ──
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

export function setCurrentRoom(roomId: string | null, options: SetCurrentRoomOptions = {}) {
  set((s) => {
    const next: ChatState = {
      ...s,
      currentRoomId: roomId,
      replyingTo: null,
      editingEvent: null,
      activeSidePanel: null,
      // 切换房间时清理多选状态
      multiSelectMode: false,
      selectedMessages: new Set(),
    }
    // 进入房间时清除手动标记未读
    if (roomId && next.markedUnreadRooms.has(roomId)) {
      const markedUnreadRooms = new Set(next.markedUnreadRooms)
      markedUnreadRooms.delete(roomId)
      next.markedUnreadRooms = markedUnreadRooms
    }
    if (roomId && options.sidebarPlacement === 'promote') {
      const promotedAt = Date.now()
      next.activeFilter = 'all'
      next.searchQuery = ''
      next.sidebarPromotionTimes = new Map(next.sidebarPromotionTimes).set(roomId, promotedAt)
      next.sidebarPromotionPreviews = new Map(next.sidebarPromotionPreviews).set(
        roomId,
        createSidebarPreview(roomId, promotedAt, options.sidebarPreview),
      )
    }
    return next
  })
}

export function setCurrentRoomFromRoute(roomId: string | null) {
  setCurrentRoom(roomId)
}

export function selectRoomFromHistory(roomId: string) {
  setCurrentRoom(roomId, { sidebarPlacement: 'history' })
}

export function setSearchQuery(query: string) {
  set((s) => ({ ...s, searchQuery: query }))
}

export function setReplyingTo(event: MatrixEvent | null) {
  set((s) => ({ ...s, editingEvent: null, replyingTo: event }))
}

export function setEditingEvent(event: MatrixEvent | null) {
  set((s) => ({ ...s, replyingTo: null, editingEvent: event }))
}

export function clearCompose() {
  set((s) => ({ ...s, replyingTo: null, editingEvent: null }))
}

export function requestMention(mention: ComposerMentionRequest) {
  set((s) => ({ ...s, pendingMentionRequests: [...s.pendingMentionRequests, mention] }))
}

export function consumePendingMentionRequests(): ComposerMentionRequest[] {
  const pending = chatStore.state.pendingMentionRequests
  set((s) => ({ ...s, pendingMentionRequests: [] }))
  return pending
}

// ── Pin ──
function applyPinTo(rooms: Set<string>, roomId: string, pinned: boolean): Set<string> {
  const next = new Set(rooms)
  if (pinned) next.add(roomId)
  else next.delete(roomId)
  return next
}

export function setPin(roomId: string, pinned: boolean) {
  set((s) => ({
    ...s,
    pinnedRooms: applyPinTo(s.pinnedRooms, roomId, pinned),
    pendingPinStates: new Map(s.pendingPinStates).set(roomId, pinned),
  }))
}

export function togglePin(roomId: string): boolean {
  const nextPinned = !isPinned(roomId)
  setPin(roomId, nextPinned)
  return nextPinned
}

export function isPinned(roomId: string): boolean {
  return chatStore.state.pinnedRooms.has(roomId)
}

// ── Mute (with optional expiry) ──
function isMuteExpiredIn(state: ChatState, roomId: string): boolean {
  const expiry = state.muteExpiry.get(roomId)
  return expiry !== undefined && Date.now() >= expiry
}

export function toggleMute(roomId: string) {
  set((s) => {
    const mutedRooms = new Set(s.mutedRooms)
    if (mutedRooms.has(roomId)) mutedRooms.delete(roomId)
    else mutedRooms.add(roomId)
    let muteExpiry = s.muteExpiry
    if (!mutedRooms.has(roomId) && s.muteExpiry.has(roomId)) {
      muteExpiry = new Map(s.muteExpiry)
      muteExpiry.delete(roomId)
    }
    return { ...s, mutedRooms, muteExpiry }
  })
  // toggleMute may clear an expiry entry — persist if it changed.
  persistMuteExpiry(chatStore.state)
}

export function isMuteExpired(roomId: string): boolean {
  return isMuteExpiredIn(chatStore.state, roomId)
}

export function isMuted(roomId: string): boolean {
  const s = chatStore.state
  return s.mutedRooms.has(roomId) && !isMuteExpiredIn(s, roomId)
}

export function setMuteExpiry(roomId: string, expiry: number | null) {
  set((s) => {
    const muteExpiry = new Map(s.muteExpiry)
    if (expiry === null) muteExpiry.delete(roomId)
    else muteExpiry.set(roomId, expiry)
    return { ...s, muteExpiry }
  })
  persistMuteExpiry(chatStore.state)
}

export function muteWithExpiry(roomId: string, expiry: number | null): boolean {
  const wasMuted = chatStore.state.mutedRooms.has(roomId)
  if (!wasMuted) set((s) => ({ ...s, mutedRooms: new Set(s.mutedRooms).add(roomId) }))
  setMuteExpiry(roomId, expiry)
  return !wasMuted
}

export function getMuteExpiry(roomId: string): number | undefined {
  return chatStore.state.muteExpiry.get(roomId)
}

export function collectExpiredMutes(): string[] {
  const s = chatStore.state
  return [...s.mutedRooms].filter((roomId) => isMuteExpiredIn(s, roomId))
}

// ── Marked unread ──
export function toggleMarkedUnread(roomId: string) {
  set((s) => {
    const markedUnreadRooms = new Set(s.markedUnreadRooms)
    if (markedUnreadRooms.has(roomId)) markedUnreadRooms.delete(roomId)
    else markedUnreadRooms.add(roomId)
    return { ...s, markedUnreadRooms }
  })
}

export function isMarkedUnread(roomId: string): boolean {
  return chatStore.state.markedUnreadRooms.has(roomId)
}

// ── Drafts ──
function setMapEntry(map: Map<string, string>, key: string, value: string): Map<string, string> {
  const next = new Map(map)
  if (value.trim()) next.set(key, value)
  else next.delete(key)
  return next
}

export function setDraft(roomId: string, text: string) {
  set((s) => ({ ...s, drafts: setMapEntry(s.drafts, roomId, text) }))
  persistDrafts(chatStore.state)
}

export function getDraft(roomId: string): string {
  return chatStore.state.drafts.get(roomId) || ''
}

export function setDraftPreview(roomId: string, preview: string) {
  set((s) => ({ ...s, draftPreviews: setMapEntry(s.draftPreviews, roomId, preview) }))
  persistDrafts(chatStore.state)
}

export function getDraftPreview(roomId: string): string {
  const s = chatStore.state
  return s.draftPreviews.get(roomId) || s.drafts.get(roomId) || ''
}

export function setHtmlDraft(roomId: string, html: string) {
  set((s) => ({ ...s, htmlDrafts: setMapEntry(s.htmlDrafts, roomId, html) }))
  persistDrafts(chatStore.state)
}

export function getHtmlDraft(roomId: string): string {
  return chatStore.state.htmlDrafts.get(roomId) || ''
}

export function clearAllDrafts(roomId: string) {
  set((s) => {
    const drafts = new Map(s.drafts)
    const htmlDrafts = new Map(s.htmlDrafts)
    const draftPreviews = new Map(s.draftPreviews)
    drafts.delete(roomId)
    htmlDrafts.delete(roomId)
    draftPreviews.delete(roomId)
    return { ...s, drafts, htmlDrafts, draftPreviews }
  })
  persistDrafts(chatStore.state)
}

// ── Sidebar promotions ──
export function getSidebarPromotionTime(roomId: string): number | undefined {
  return chatStore.state.sidebarPromotionTimes.get(roomId)
}

export function getSidebarPromotionRoomIds(): string[] {
  return [...chatStore.state.sidebarPromotionTimes.keys()]
}

export function getSidebarPromotionPreview(roomId: string): RoomSummary | undefined {
  return chatStore.state.sidebarPromotionPreviews.get(roomId)
}

export function clearSidebarPromotions() {
  set((s) => ({ ...s, sidebarPromotionTimes: new Map(), sidebarPromotionPreviews: new Map() }))
}

// ── Filter ──
export function setFilter(filter: ConversationFilter) {
  set((s) => ({ ...s, activeFilter: filter }))
}

// ── Context menu ──
export function openContextMenu(roomId: string, x: number, y: number) {
  set((s) => ({ ...s, contextMenu: { roomId, x, y } }))
}

export function closeContextMenu() {
  set((s) => ({ ...s, contextMenu: null }))
}

// ── Sync pin/mute state from the server ──
export function syncServerState(rooms: RoomSummary[]) {
  set((s) => {
    const pinnedRooms = new Set<string>()
    const mutedRooms = new Set<string>()
    const pendingPinStates = new Map(s.pendingPinStates)
    const serverMutedRoomIds = new Set<string>()

    for (const r of rooms) {
      const pendingPin = pendingPinStates.get(r.roomId)
      const pinned = pendingPin ?? r.isPinned
      if (pendingPin !== undefined && pendingPin === r.isPinned) pendingPinStates.delete(r.roomId)
      if (pinned) pinnedRooms.add(r.roomId)
      if (r.isMuted) {
        mutedRooms.add(r.roomId)
        serverMutedRoomIds.add(r.roomId)
      }
    }

    const muteExpiry = new Map(s.muteExpiry)
    for (const roomId of [...muteExpiry.keys()]) {
      if (!serverMutedRoomIds.has(roomId)) muteExpiry.delete(roomId)
    }

    return { ...s, pinnedRooms, mutedRooms, pendingPinStates, muteExpiry }
  })
  persistMuteExpiry(chatStore.state)
}

// ── Hidden messages ──
export function hideMessage(eventId: string) {
  set((s) => ({ ...s, hiddenMessages: new Set(s.hiddenMessages).add(eventId) }))
}

export function isHidden(eventId: string): boolean {
  return chatStore.state.hiddenMessages.has(eventId)
}

// ── Multi-select ──
export function enterMultiSelect() {
  set((s) => ({ ...s, multiSelectMode: true }))
}

export function exitMultiSelect() {
  set((s) => ({ ...s, multiSelectMode: false, selectedMessages: new Set() }))
}

export function toggleMessageSelection(eventId: string) {
  set((s) => {
    const selectedMessages = new Set(s.selectedMessages)
    if (selectedMessages.has(eventId)) selectedMessages.delete(eventId)
    else selectedMessages.add(eventId)
    return { ...s, selectedMessages }
  })
}

export function isMessageSelected(eventId: string): boolean {
  return chatStore.state.selectedMessages.has(eventId)
}

// ── Thread ──
export function openThread(eventId: string) {
  set((s) => ({ ...s, activeThreadId: eventId }))
}

export function closeThread() {
  set((s) => ({ ...s, activeThreadId: null }))
}

// ── Side panel ──
export function setActiveTab(_tab: string) {
  // No-op: tabs removed, kept for API compat
}

export function toggleSidePanel(panel: SidePanelType) {
  set((s) => ({ ...s, activeSidePanel: s.activeSidePanel === panel ? null : panel }))
}

export function closeSidePanel() {
  set((s) => ({ ...s, activeSidePanel: null }))
}

export function resetChatStore() {
  set(() => createInitialState())
}
