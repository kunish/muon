import type { MatrixClient, MatrixEvent } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { getClient } from './client'

export interface InboxEventContext {
  roomId: string
  eventId: string
  eventsBefore: MatrixEvent[]
  event: MatrixEvent
  eventsAfter: MatrixEvent[]
}

/** Raw context payload from the matrix client's getEventContext / authedRequest */
interface ContextPayload {
  event?: MatrixEvent
  events_before?: MatrixEvent[]
  events_after?: MatrixEvent[]
}

function normalizeContextPayloadEffect(
  roomId: string,
  eventId: string,
  payload: ContextPayload,
): DesktopEffect<InboxEventContext> {
  return fromSync(() => {
    if (!payload?.event) throw new Error(`target event ${eventId} missing in context payload`)

    return {
      roomId,
      eventId,
      eventsBefore: payload.events_before ?? [],
      event: payload.event,
      eventsAfter: payload.events_after ?? [],
    }
  })
}

/** getEventContext is private in matrix-js-sdk typing, so we need a narrow cast */
interface ClientWithContextAPI {
  getEventContext: (roomId: string, eventId: string, limit: number) => Promise<ContextPayload>
  http?: { authedRequest: (method: string, path: string, params: Record<string, unknown>) => Promise<ContextPayload> }
}

function fallbackLoadContextEffect(roomId: string, eventId: string, limit: number): DesktopEffect<InboxEventContext> {
  return Effect.gen(function* () {
    const client = getClient() as unknown as ClientWithContextAPI

    if (typeof client.getEventContext === 'function') {
      const payload = yield* fromPromise(() => client.getEventContext(roomId, eventId, limit))
      return yield* normalizeContextPayloadEffect(roomId, eventId, payload)
    }

    if (client.http?.authedRequest) {
      const payload = yield* fromPromise(() =>
        client.http!.authedRequest(
          'GET',
          `/rooms/${encodeURIComponent(roomId)}/context/${encodeURIComponent(eventId)}`,
          {
            limit,
          },
        ),
      )
      return yield* normalizeContextPayloadEffect(roomId, eventId, payload)
    }

    return yield* fromSync(() => {
      throw new Error('no context API available on matrix client')
    })
  })
}

export function loadInboxEventContextEffect(
  roomId: string,
  eventId: string,
  limit = 20,
): DesktopEffect<InboxEventContext> {
  return Effect.gen(function* () {
    const client: MatrixClient = getClient()
    const room = client.getRoom(roomId)
    if (!room) throw new Error(`room ${roomId} not found`)

    const timelineSet = room.getUnfilteredTimelineSet?.()
    if (!timelineSet) throw new Error(`timeline set missing for room ${roomId}`)

    const timeline = yield* fromPromise(() => client.getEventTimeline(timelineSet, eventId))
    if (!timeline) return yield* fallbackLoadContextEffect(roomId, eventId, limit)

    yield* fromPromise(() => client.paginateEventTimeline(timeline, { backwards: true, limit }))
    yield* fromPromise(() => client.paginateEventTimeline(timeline, { backwards: false, limit }))

    const events = timeline.getEvents() as MatrixEvent[]
    const targetIndex = events.findIndex((event) => event.getId() === eventId)
    if (targetIndex === -1) return yield* fallbackLoadContextEffect(roomId, eventId, limit)

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
  }).pipe(
    Effect.catchAll((error) =>
      fromSync(() => {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`Failed to load inbox event context (${roomId}/${eventId}): ${message}`)
      }),
    ),
  )
}

export function loadInboxEventContext(roomId: string, eventId: string, limit = 20): Promise<InboxEventContext> {
  return runDesktopEffect(loadInboxEventContextEffect(roomId, eventId, limit))
}
