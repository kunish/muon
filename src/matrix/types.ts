export interface MatrixConfig {
  serverUrl: string
  userId?: string
  accessToken?: string
  deviceId?: string
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface RegisterParams {
  username: string
  password: string
  displayName?: string
}

export type SyncState = 'PREPARED' | 'SYNCING' | 'ERROR' | 'STOPPED'

export interface RoomSummary {
  roomId: string
  name: string
  avatar?: string
  lastMessage?: string
  lastMessageTs?: number
  lastMessageSender?: string
  lastMessageType?: string
  unreadCount: number
  isDirect: boolean
  isEncrypted: boolean
  members: string[]
  dmUserId?: string
  dmUserAvatar?: string
  /** Matrix room tag: m.favourite = pinned */
  isPinned: boolean
  /** Matrix push rule: muted */
  isMuted: boolean
  /** Highlight count (@ mentions) */
  highlightCount: number
  /** Total joined member count */
  memberCount: number
}

export interface MessageContent {
  'msgtype': string
  'body': string
  'format'?: string
  'formatted_body'?: string
  'url'?: string
  'info'?: Record<string, unknown>
  'm.relates_to'?: {
    rel_type: string
    event_id: string
  }
}

// Re-export Space types from spaces.ts for convenience
export type { CategoryInfo, ChannelInfo, SpaceInfo, SpaceMember } from './spaces'
