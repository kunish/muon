export type CallState = 'idle' | 'ringing' | 'connecting' | 'connected' | 'ended'
export type CallType = 'audio' | 'video'

export interface CallInfo {
  roomId: string
  callId: string
  type: CallType
  initiator: string
  participants: string[]
  startedAt?: number
  endedAt?: number
}

export interface CallHistoryEntry {
  callId: string
  roomId: string
  type: CallType
  initiator: string
  duration: number
  timestamp: number
  missed: boolean
}
