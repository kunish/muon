import type { MatrixEvent } from 'matrix-js-sdk'
import { getClient } from '@matrix/client'

export interface InboxEventContext {
  roomId: string
  eventId: string
  eventsBefore: MatrixEvent[]
  event: MatrixEvent
  eventsAfter: MatrixEvent[]
}

function normalizeContextPayload(roomId: string, eventId: string, payload: any): InboxEventContext {
  if (!payload?.event)
    throw new Error(`target event ${eventId} missing in context payload`)

  return {
    roomId,
    eventId,
    eventsBefore: payload.events_before ?? [],
    event: payload.event,
    eventsAfter: payload.events_after ?? [],
  }
}

async function fallbackLoadContext(roomId: string, eventId: string, limit: number): Promise<InboxEventContext> {
  const client = getClient() as any

  if (typeof client.getEventContext === 'function') {
    const payload = await client.getEventContext(roomId, eventId, limit)
    return normalizeContextPayload(roomId, eventId, payload)
  }

  if (client.http?.authedRequest) {
    const payload = await client.http.authedRequest(
      'GET',
      `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`,
      { limit },
    )
    return normalizeContextPayload(roomId, eventId, payload)
  }

  throw new Error('no context API available on matrix client')
}

export async function loadInboxEventContext(roomId: string, eventId: string, limit = 20): Promise<InboxEventContext> {
  try {
    const client = getClient() as any
    const room = client.getRoom(roomId)
    if (!room)
      throw new Error(`room ${roomId} not found`)

    const timelineSet = room.getUnfilteredTimelineSet?.()
    if (!timelineSet)
      throw new Error(`timeline set missing for room ${roomId}`)

    const timeline = await client.getEventTimeline(timelineSet, eventId)
    if (!timeline)
      return await fallbackLoadContext(roomId, eventId, limit)

    await client.paginateEventTimeline(timeline, { backwards: true, limit })
    await client.paginateEventTimeline(timeline, { backwards: false, limit })

    const events = timeline.getEvents() as MatrixEvent[]
    const targetIndex = events.findIndex(event => event.getId() === eventId)
    if (targetIndex === -1)
      return await fallbackLoadContext(roomId, eventId, limit)

    const eventsBefore = events.slice(Math.max(0, targetIndex - limit), targetIndex)
    const event = events[targetIndex]
    const eventsAfter = events.slice(targetIndex + 1, targetIndex + 1 + limit)

    return {
      roomId,
      eventId,
      eventsBefore,
      event,
      eventsAfter,
    }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Failed to load inbox event context (${roomId}/${eventId}): ${message}`)
  }
}
