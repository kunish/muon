import type { MatrixEvent, Room } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { EventTimeline, RelationType } from 'matrix-js-sdk'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from '../client'
import { matrixEvents } from '../events'

/** 可见的内容事件类型 */
const CONTENT_TYPES = new Set(['m.room.message', 'm.sticker', 'm.room.encrypted'])

/** 飞书风格：需要在聊天中展示的系统事件类型 */
export const SYSTEM_EVENT_TYPES = new Set([
  'm.room.member', // 入群/退群/被踢/邀请/封禁
  'm.room.name', // 群名变更
  'm.room.topic', // 群话题变更
  'm.room.create', // 房间创建
])

export const DISPLAYABLE_MEMBER_MEMBERSHIPS = new Set(['join', 'leave', 'ban', 'invite'])

const backwardPaginationByRoomId = new Map<string, Promise<boolean>>()

export function getTimelineEffect(roomId: string, limit = 50): DesktopEffect<MatrixEvent[]> {
  return fromSync(() => {
    const room = getClient().getRoom(roomId)
    if (!room) return []

    return getLinkedTimelineEvents(room).filter(isDisplayableTimelineEvent).slice(-limit)
  })
}

export function getTimeline(roomId: string, limit = 50): MatrixEvent[] {
  return runDesktopSync(getTimelineEffect(roomId, limit))
}

export function getLinkedTimelineEventsEffect(room: Room): DesktopEffect<MatrixEvent[]> {
  return fromSync(() => {
    const liveTimeline = room.getLiveTimeline()
    const timelines: EventTimeline[] = []
    const seenTimelines = new Set<EventTimeline>()

    let timeline: EventTimeline | null = liveTimeline
    while (timeline && !seenTimelines.has(timeline)) {
      seenTimelines.add(timeline)
      timelines.unshift(timeline)
      timeline = timeline.getNeighbouringTimeline?.(EventTimeline.BACKWARDS) ?? null
    }

    const events: MatrixEvent[] = []
    const seenEventIds = new Set<string>()
    for (const item of timelines) {
      for (const event of item.getEvents()) {
        const eventId = event.getId()
        if (eventId) {
          if (seenEventIds.has(eventId)) continue
          seenEventIds.add(eventId)
        }
        events.push(event)
      }
    }

    return events
  })
}

export function getLinkedTimelineEvents(room: Room): MatrixEvent[] {
  return runDesktopSync(getLinkedTimelineEventsEffect(room))
}

export function isDisplayableTimelineEventEffect(ev: MatrixEvent): DesktopEffect<boolean> {
  return fromSync(() => {
    const evType = ev.getType()

    // 内容类事件
    if (CONTENT_TYPES.has(evType)) {
      // Hide edit replacement events (aggregated into original)
      const relType = ev.getContent()?.['m.relates_to']?.rel_type
      if (relType === RelationType.Replace) return false
      // Hide redaction events themselves
      if (evType === 'm.room.redaction') return false
      return true
    }

    if (SYSTEM_EVENT_TYPES.has(evType)) return isDisplayableSystemEvent(ev)

    return false
  })
}

export function isDisplayableTimelineEvent(ev: MatrixEvent): boolean {
  return runDesktopSync(isDisplayableTimelineEventEffect(ev))
}

export function isDisplayableSystemEventEffect(ev: MatrixEvent): DesktopEffect<boolean> {
  return fromSync(() => {
    if (ev.getType() !== 'm.room.member') return true

    const membership = ev.getContent()?.membership
    const prevMembership = ev.getPrevContent()?.membership
    if (membership === prevMembership) return false

    return typeof membership === 'string' && DISPLAYABLE_MEMBER_MEMBERSHIPS.has(membership)
  })
}

export function isDisplayableSystemEvent(ev: MatrixEvent): boolean {
  return runDesktopSync(isDisplayableSystemEventEffect(ev))
}

export function paginateBackEffect(roomId: string, count = 20): DesktopEffect<boolean> {
  return fromSync(() => {
    const existing = backwardPaginationByRoomId.get(roomId)
    if (existing) return existing

    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room) return Promise.resolve(false)

    const request = client
      .paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: count })
      .then((loaded) => {
        matrixEvents.emit('room.timeline', { roomId })
        return loaded
      })
      .finally(() => {
        if (backwardPaginationByRoomId.get(roomId) === request) backwardPaginationByRoomId.delete(roomId)
      })

    backwardPaginationByRoomId.set(roomId, request)
    return request
  }).pipe(Effect.flatMap((request) => fromPromise(() => request)))
}

export function paginateBack(roomId: string, count = 20): Promise<boolean> {
  return runDesktopEffect(paginateBackEffect(roomId, count))
}
