import type { MatrixEvent } from 'matrix-js-sdk'

export interface InboxEventContext {
  roomId: string
  eventId: string
  eventsBefore: MatrixEvent[]
  event: MatrixEvent
  eventsAfter: MatrixEvent[]
}

export async function loadInboxEventContext(roomId: string, eventId: string, _limit = 20): Promise<InboxEventContext> {
  throw new Error(`INBX-03 not implemented yet: ${roomId}/${eventId}`)
}
