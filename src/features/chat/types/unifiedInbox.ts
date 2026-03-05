export type UnifiedInboxItemType = 'mention' | 'priority-unread' | 'reply-needed'

export type InboxFilterType = 'all' | UnifiedInboxItemType

export interface UnifiedInboxItem {
  id: string
  roomId: string
  roomName: string
  eventId: string
  type: UnifiedInboxItemType
  createdTs: number
  snippet?: string
  unreadCount: number
  highlightCount: number
}

export interface InboxProcessedState {
  processedIds: string[]
}

export const INBOX_PROCESSED_STORAGE_KEY = 'muon:inbox:processed:v1'
