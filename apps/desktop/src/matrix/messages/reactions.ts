import type { MatrixEvent } from 'matrix-js-sdk'
import type { RoomMessageEventContent } from 'matrix-js-sdk/lib/@types/events'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import { EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
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
export function sendReactionEffect(roomId: string, eventId: string, emoji: string): DesktopEffect<void> {
  return fromPromise(() =>
    getClient().sendEvent(roomId, EventType.Reaction, {
      'm.relates_to': {
        rel_type: RelationType.Annotation,
        event_id: eventId,
        key: emoji,
      },
    }),
  ).pipe(Effect.asVoid)
}

export function sendReaction(roomId: string, eventId: string, emoji: string): Promise<void> {
  return runDesktopEffect(sendReactionEffect(roomId, eventId, emoji))
}

/** 获取某条消息的 thread 回复列表 */
export function getThreadRepliesEffect(roomId: string, threadRootId: string): DesktopEffect<MatrixEvent[]> {
  return fromSync(() => {
    const room = getClient().getRoom(roomId)
    if (!room) return []

    return getLinkedTimelineEvents(room).filter((e) => {
      const rel = e.getContent()?.['m.relates_to']
      return (
        !e.isRedacted() &&
        rel?.rel_type === 'm.thread' &&
        rel?.event_id === threadRootId &&
        isDisplayableTimelineEvent(e)
      )
    })
  })
}

export function getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
  return runDesktopSync(getThreadRepliesEffect(roomId, threadRootId))
}

export function getTimelineRelationSummariesEffect(roomId: string): DesktopEffect<TimelineRelationSummaries> {
  return fromSync(() => {
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
  })
}

export function getTimelineRelationSummaries(roomId: string): TimelineRelationSummaries {
  return runDesktopSync(getTimelineRelationSummariesEffect(roomId))
}

/** 在 thread 中发送回复 */
export function sendThreadReplyEffect(roomId: string, threadRootId: string, body: string): DesktopEffect<string> {
  return Effect.gen(function* () {
    const { event_id } = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Text,
        body,
        'm.relates_to': {
          rel_type: 'm.thread',
          event_id: threadRootId,
          is_falling_back: true,
          'm.in_reply_to': { event_id: threadRootId },
        },
      } as RoomMessageEventContent),
    )
    return event_id
  })
}

export function sendThreadReply(roomId: string, threadRootId: string, body: string): Promise<string> {
  return runDesktopEffect(sendThreadReplyEffect(roomId, threadRootId, body))
}

/** 获取事件的 reactions 汇总 */
export function getReactionsEffect(roomId: string, eventId: string): DesktopEffect<ReactionSummary[]> {
  return Effect.map(
    getTimelineRelationSummariesEffect(roomId),
    (summaries) => summaries.reactionsByEventId.get(eventId) ?? [],
  )
}

export function getReactions(roomId: string, eventId: string): ReactionSummary[] {
  return runDesktopSync(getReactionsEffect(roomId, eventId))
}
