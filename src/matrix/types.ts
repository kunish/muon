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
  unreadCount: number
  isDirect: boolean
  isEncrypted: boolean
  members: string[]
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
