import type { MatrixEvent } from 'matrix-js-sdk'

export interface ChatMessage {
  event: MatrixEvent
  isMine: boolean
  showSender: boolean
  showTimestamp: boolean
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'
