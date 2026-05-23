import type { MatrixEvent } from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import { EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { getClient } from '../client'
import { getLinkedTimelineEvents, isDisplayableTimelineEvent } from './timeline'

export interface ReactionSummary {
  key: string
  count: number
  myReaction: boolean
}

export interface TimelineRelationSummaries {
  reactionsByEventId: Map<string, ReactionSummary[]>
  threadReplyCountsByEventId: Map<string, number>
}

/** 发送 emoji reaction */
export async function sendReaction(roomId: string, eventId: string, emoji: string): Promise<void> {
  await getClient().sendEvent(roomId, EventType.Reaction, {
    'm.relates_to': {
      rel_type: RelationType.Annotation,
      event_id: eventId,
      key: emoji,
    },
  })
}

/** 获取某条消息的 thread 回复列表 */
export function getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
  const room = getClient().getRoom(roomId)
  if (!room) return []

  return getLinkedTimelineEvents(room).filter((e) => {
    const rel = e.getContent()?.['m.relates_to']
    return (
      !e.isRedacted() && rel?.rel_type === 'm.thread' && rel?.event_id === threadRootId && isDisplayableTimelineEvent(e)
    )
  })
}

export function getTimelineRelationSummaries(roomId: string): TimelineRelationSummaries {
  const client = getClient()
  const room = client.getRoom(roomId)
  const reactionsByEventId = new Map<string, ReactionSummary[]>()
  const threadReplyCountsByEventId = new Map<string, number>()
  if (!room) return { reactionsByEventId, threadReplyCountsByEventId }

  const userId = client.getUserId()
  const reactionBuckets = new Map<string, Map<string, ReactionSummary>>()

  for (const ev of getLinkedTimelineEvents(room)) {
    if (ev.isRedacted()) continue

    const rel = ev.getContent()?.['m.relates_to']
    const relatedEventId = rel?.event_id
    if (!relatedEventId) continue

    if (ev.getType() === 'm.reaction' && rel.rel_type === RelationType.Annotation) {
      const key = rel.key
      if (!key) continue

      let eventReactions = reactionBuckets.get(relatedEventId)
      if (!eventReactions) {
        eventReactions = new Map()
        reactionBuckets.set(relatedEventId, eventReactions)
      }

      const existing = eventReactions.get(key) ?? { key, count: 0, myReaction: false }
      existing.count++
      if (ev.getSender() === userId) existing.myReaction = true
      eventReactions.set(key, existing)
      continue
    }

    if (rel.rel_type === 'm.thread' && isDisplayableTimelineEvent(ev)) {
      threadReplyCountsByEventId.set(relatedEventId, (threadReplyCountsByEventId.get(relatedEventId) ?? 0) + 1)
    }
  }

  for (const [eventId, reactions] of reactionBuckets) {
    reactionsByEventId.set(eventId, [...reactions.values()])
  }

  return { reactionsByEventId, threadReplyCountsByEventId }
}

/** 在 thread 中发送回复 */
export async function sendThreadReply(roomId: string, threadRootId: string, body: string): Promise<string> {
  const { event_id } = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Text,
    body,
    'm.relates_to': {
      rel_type: 'm.thread',
      event_id: threadRootId,
      is_falling_back: true,
      'm.in_reply_to': { event_id: threadRootId },
    },
  } as RoomMessageEventContent)
  return event_id
}

/** 获取事件的 reactions 汇总 */
export function getReactions(roomId: string, eventId: string): ReactionSummary[] {
  return getTimelineRelationSummaries(roomId).reactionsByEventId.get(eventId) ?? []
}
