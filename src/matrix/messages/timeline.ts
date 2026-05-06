import type { MatrixEvent, Room } from 'matrix-js-sdk'
import { EventTimeline, RelationType } from 'matrix-js-sdk'
import { getClient } from '../client'

/** 可见的内容事件类型 */
const CONTENT_TYPES = new Set([
  'm.room.message',
  'm.sticker',
  'm.room.encrypted',
])

/** 飞书风格：需要在聊天中展示的系统事件类型 */
export const SYSTEM_EVENT_TYPES = new Set([
  'm.room.member', // 入群/退群/被踢/邀请/封禁
  'm.room.name', // 群名变更
  'm.room.topic', // 群话题变更
  'm.room.create', // 房间创建
])

export const DISPLAYABLE_MEMBER_MEMBERSHIPS = new Set(['join', 'leave', 'ban', 'invite'])

export function getTimeline(roomId: string, limit = 50): MatrixEvent[] {
  const room = getClient().getRoom(roomId)
  if (!room)
    return []

  return getLinkedTimelineEvents(room).filter(isDisplayableTimelineEvent).slice(-limit)
}

export function getLinkedTimelineEvents(room: Room): MatrixEvent[] {
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
        if (seenEventIds.has(eventId))
          continue
        seenEventIds.add(eventId)
      }
      events.push(event)
    }
  }

  return events
}

export function isDisplayableTimelineEvent(ev: MatrixEvent): boolean {
  const evType = ev.getType()

  // 内容类事件
  if (CONTENT_TYPES.has(evType)) {
    // Hide edit replacement events (aggregated into original)
    const relType = ev.getContent()?.['m.relates_to']?.rel_type
    if (relType === RelationType.Replace)
      return false
    // Hide redaction events themselves
    if (evType === 'm.room.redaction')
      return false
    return true
  }

  if (SYSTEM_EVENT_TYPES.has(evType))
    return isDisplayableSystemEvent(ev)

  return false
}

export function isDisplayableSystemEvent(ev: MatrixEvent): boolean {
  if (ev.getType() !== 'm.room.member')
    return true

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  if (membership === prevMembership)
    return false

  return typeof membership === 'string' && DISPLAYABLE_MEMBER_MEMBERSHIPS.has(membership)
}

export async function paginateBack(roomId: string, count = 20): Promise<boolean> {
  const room = getClient().getRoom(roomId)
  if (!room)
    return false
  return getClient().paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: count })
}
