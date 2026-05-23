import type { MatrixEvent } from 'matrix-js-sdk'
import { localizedText } from '@/shared/lib/localizedText'
import { getClient } from '../client'
import { isDisplayableSystemEvent, SYSTEM_EVENT_TYPES } from './timeline'

/** 判断事件是否为系统事件（用于 UI 渲染区分） */
export function isSystemEvent(ev: MatrixEvent): boolean {
  return SYSTEM_EVENT_TYPES.has(ev.getType()) && isDisplayableSystemEvent(ev)
}

/** 系统事件描述的结构化片段 */
export interface SystemEventPart {
  /** text=普通文字, user=可点击的用户名, highlight=高亮文本(如群名/话题) */
  type: 'text' | 'user' | 'highlight'
  text: string
  userId?: string
}

/** 系统事件的结构化描述 */
export interface SystemEventInfo {
  /** 事件类型标识，用于选择图标 */
  kind: 'join' | 'leave' | 'kick' | 'ban' | 'invite' | 'room_name' | 'room_topic' | 'room_create' | 'unknown'
  /** 结构化描述片段列表 */
  parts: SystemEventPart[]
}

function systemEventText(key: string): SystemEventPart {
  return { type: 'text', text: localizedText(`system_events.${key}`) }
}

interface MergeableMemberEvent {
  kind: 'invite' | 'invite_join'
  key: string
  roomId: string
  sender: string
  targetId: string
  targetFallbackName: string
  ts: number
}

interface RoomCreationSetupEvent {
  kind: 'create' | 'creator_join' | 'room_name' | 'room_topic' | 'invite'
  roomId: string
  actor: string
  targetId?: string
  targetFallbackName?: string
  name?: string
  topic?: string
  ts: number
}

/** 获取系统事件的结构化描述（用于丰富渲染） */
export function getSystemEventInfo(eventOrEvents: MatrixEvent | MatrixEvent[]): SystemEventInfo {
  const events = Array.isArray(eventOrEvents) ? eventOrEvents : [eventOrEvents]
  const ev = events[0]
  if (!ev) {
    return {
      kind: 'unknown',
      parts: [],
    }
  }

  if (events.length > 1) {
    const mergedInfo = getMergedSystemEventInfo(events)
    if (mergedInfo) return mergedInfo
  }

  const evType = ev.getType()
  const sender = ev.getSender() || ''
  const client = getClient()
  const room = client.getRoom(ev.getRoomId()!)
  const senderMember = room?.getMember(sender)
  const senderName = senderMember?.name || sender.split(':')[0]?.slice(1) || sender

  if (evType === 'm.room.member') {
    const membership = ev.getContent()?.membership
    const prevMembership = ev.getPrevContent()?.membership
    const targetId = ev.getStateKey() || ''
    const targetMember = room?.getMember(targetId)
    const targetName =
      targetMember?.name || ev.getContent()?.displayname || targetId.split(':')[0]?.slice(1) || targetId

    // 加入
    if (membership === 'join' && prevMembership !== 'join') {
      if (sender === targetId) {
        // 自己加入（通过链接等）
        return {
          kind: 'join',
          parts: [{ type: 'user', text: targetName, userId: targetId }, systemEventText('joined_group')],
        }
      }
      // 被邀请加入
      return {
        kind: 'join',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          systemEventText('invited_to_join'),
          { type: 'user', text: targetName, userId: targetId },
          systemEventText('to_join_group'),
        ],
      }
    }

    // 离开
    if (membership === 'leave') {
      if (sender === targetId) {
        return {
          kind: 'leave',
          parts: [{ type: 'user', text: targetName, userId: targetId }, systemEventText('left_group')],
        }
      }
      // 被踢出
      return {
        kind: 'kick',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          systemEventText('removed'),
          { type: 'user', text: targetName, userId: targetId },
          systemEventText('from_group'),
        ],
      }
    }

    // 被封禁
    if (membership === 'ban') {
      return {
        kind: 'ban',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          systemEventText('banned'),
          { type: 'user', text: targetName, userId: targetId },
          systemEventText('from_joining_group'),
        ],
      }
    }

    // 邀请（还未加入）
    if (membership === 'invite') {
      return {
        kind: 'invite',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          systemEventText('invited'),
          { type: 'user', text: targetName, userId: targetId },
        ],
      }
    }

    return {
      kind: 'unknown',
      parts: [{ type: 'user', text: targetName, userId: targetId }, systemEventText('membership_changed')],
    }
  }

  if (evType === 'm.room.name') {
    const newName = ev.getContent()?.name || ''
    return {
      kind: 'room_name',
      parts: [
        { type: 'user', text: senderName, userId: sender },
        systemEventText('renamed_group_to'),
        { type: 'highlight', text: `"${newName}"` },
      ],
    }
  }

  if (evType === 'm.room.topic') {
    const newTopic = ev.getContent()?.topic || ''
    return {
      kind: 'room_topic',
      parts: [
        { type: 'user', text: senderName, userId: sender },
        systemEventText('changed_topic_to'),
        { type: 'highlight', text: `"${newTopic}"` },
      ],
    }
  }

  if (evType === 'm.room.create') {
    return {
      kind: 'room_create',
      parts: [{ type: 'user', text: senderName, userId: sender }, systemEventText('created_this_group')],
    }
  }

  return {
    kind: 'unknown',
    parts: [{ type: 'user', text: senderName, userId: sender }, systemEventText('triggered_event')],
  }
}

const SYSTEM_EVENT_MERGE_WINDOW_MS = 2 * 60 * 1000

function fallbackNameFromUserId(userId: string): string {
  return userId.split(':')[0]?.slice(1) || userId
}

function getMergeableMemberEvent(ev: MatrixEvent): MergeableMemberEvent | null {
  if (ev.getType() !== 'm.room.member') return null

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  const roomId = ev.getRoomId()
  const sender = ev.getSender()
  const targetId = ev.getStateKey()
  if (!roomId || !sender || !targetId || sender === targetId) return null

  const kind =
    membership === 'invite' ? 'invite' : membership === 'join' && prevMembership === 'invite' ? 'invite_join' : null
  if (!kind) return null

  const targetFallbackName = ev.getContent()?.displayname || fallbackNameFromUserId(targetId)

  return {
    kind,
    key: `${kind}:${roomId}:${sender}`,
    roomId,
    sender,
    targetId,
    targetFallbackName,
    ts: ev.getTs(),
  }
}

function getRoomCreationSetupEvent(ev: MatrixEvent): RoomCreationSetupEvent | null {
  const roomId = ev.getRoomId()
  const actor = ev.getSender()
  if (!roomId || !actor) return null

  const evType = ev.getType()
  const ts = ev.getTs()

  if (evType === 'm.room.create') {
    return {
      kind: 'create',
      roomId,
      actor,
      ts,
    }
  }

  if (evType === 'm.room.name') {
    const name = ev.getContent()?.name
    return {
      kind: 'room_name',
      roomId,
      actor,
      name: typeof name === 'string' ? name : '',
      ts,
    }
  }

  if (evType === 'm.room.topic') {
    const topic = ev.getContent()?.topic
    return {
      kind: 'room_topic',
      roomId,
      actor,
      topic: typeof topic === 'string' ? topic : '',
      ts,
    }
  }

  if (evType !== 'm.room.member') return null

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  const targetId = ev.getStateKey()
  if (!targetId) return null

  if (membership === 'join' && prevMembership !== 'join' && targetId === actor) {
    return {
      kind: 'creator_join',
      roomId,
      actor,
      targetId,
      targetFallbackName: ev.getContent()?.displayname || fallbackNameFromUserId(targetId),
      ts,
    }
  }

  if (membership === 'invite' && targetId !== actor) {
    return {
      kind: 'invite',
      roomId,
      actor,
      targetId,
      targetFallbackName: ev.getContent()?.displayname || fallbackNameFromUserId(targetId),
      ts,
    }
  }

  return null
}

function canMergeRoomCreationSetupEvents(previousEvents: MatrixEvent[], next: MatrixEvent): boolean {
  const setupEvents = previousEvents.map(getRoomCreationSetupEvent)
  if (setupEvents.includes(null)) return false

  const first = setupEvents[0]
  const nextSetup = getRoomCreationSetupEvent(next)
  if (!first || first.kind !== 'create' || !nextSetup || nextSetup.kind === 'create') return false

  return [...setupEvents, nextSetup].every(
    (item) =>
      item !== null &&
      item.roomId === first.roomId &&
      item.actor === first.actor &&
      Math.abs(item.ts - first.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS,
  )
}

function findLastSetupEvent(
  events: RoomCreationSetupEvent[],
  predicate: (event: RoomCreationSetupEvent) => boolean,
): RoomCreationSetupEvent | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (predicate(event)) return event
  }
  return undefined
}

export function canMergeSystemEvents(previous: MatrixEvent | MatrixEvent[], next: MatrixEvent): boolean {
  const previousEvents = Array.isArray(previous) ? previous : [previous]
  const prev = previousEvents.at(-1)
  if (!prev) return false

  if (canMergeRoomCreationSetupEvents(previousEvents, next)) return true

  const prevMerge = getMergeableMemberEvent(prev)
  const nextMerge = getMergeableMemberEvent(next)
  if (!prevMerge || !nextMerge || prevMerge.key !== nextMerge.key) return false

  return Math.abs(nextMerge.ts - prevMerge.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS
}

function getMergedSystemEventInfo(events: MatrixEvent[]): SystemEventInfo | null {
  const roomCreationInfo = getMergedRoomCreationSystemEventInfo(events)
  if (roomCreationInfo) return roomCreationInfo

  const first = getMergeableMemberEvent(events[0])
  if (!first) return null

  const memberEvents = events
    .map(getMergeableMemberEvent)
    .filter((item): item is MergeableMemberEvent => item !== null && item.key === first.key)

  if (memberEvents.length !== events.length || memberEvents.length < 2) return null

  const client = getClient()
  const room = client.getRoom(first.roomId)
  const senderMember = room?.getMember(first.sender)
  const senderName = senderMember?.name || first.sender.split(':')[0]?.slice(1) || first.sender
  const parts: SystemEventPart[] = [
    { type: 'user', text: senderName, userId: first.sender },
    systemEventText(first.kind === 'invite' ? 'invited' : 'invited_to_join'),
  ]
  const seenTargets = new Set<string>()

  for (const memberEvent of memberEvents) {
    if (seenTargets.has(memberEvent.targetId)) continue
    seenTargets.add(memberEvent.targetId)
    if (seenTargets.size > 1) parts.push(systemEventText('list_separator'))

    const targetMember = room?.getMember(memberEvent.targetId)
    const targetName = targetMember?.name || memberEvent.targetFallbackName
    parts.push({ type: 'user', text: targetName, userId: memberEvent.targetId })
  }

  if (first.kind === 'invite_join') parts.push(systemEventText('to_join_group'))

  return {
    kind: first.kind === 'invite' ? 'invite' : 'join',
    parts,
  }
}

function getMergedRoomCreationSystemEventInfo(events: MatrixEvent[]): SystemEventInfo | null {
  const setupEvents: RoomCreationSetupEvent[] = []
  for (const event of events) {
    const setupEvent = getRoomCreationSetupEvent(event)
    if (!setupEvent) return null
    setupEvents.push(setupEvent)
  }

  const first = setupEvents[0]
  if (!first || first.kind !== 'create' || setupEvents.length < 2) return null

  if (
    !setupEvents.every(
      (item) =>
        item.roomId === first.roomId &&
        item.actor === first.actor &&
        Math.abs(item.ts - first.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS,
    )
  ) {
    return null
  }

  const client = getClient()
  const room = client.getRoom(first.roomId)
  const actorMember = room?.getMember(first.actor)
  const actorName = actorMember?.name || fallbackNameFromUserId(first.actor)
  const roomName = findLastSetupEvent(setupEvents, (item) => item.kind === 'room_name' && !!item.name)?.name
  const roomTopic = findLastSetupEvent(setupEvents, (item) => item.kind === 'room_topic' && !!item.topic)?.topic
  const inviteEvents = setupEvents.filter((item) => item.kind === 'invite' && item.targetId)

  const parts: SystemEventPart[] = [{ type: 'user', text: actorName, userId: first.actor }]

  if (roomName) {
    parts.push(systemEventText('created_group_named'), { type: 'highlight', text: `"${roomName}"` })
  } else {
    parts.push(systemEventText('created_this_group'))
  }

  if (roomTopic) {
    parts.push(systemEventText('with_topic'), { type: 'highlight', text: `"${roomTopic}"` })
  }

  const seenTargets = new Set<string>()
  for (const inviteEvent of inviteEvents) {
    if (!inviteEvent.targetId || seenTargets.has(inviteEvent.targetId)) continue
    seenTargets.add(inviteEvent.targetId)

    if (seenTargets.size === 1) parts.push(systemEventText('and_invited'))
    else parts.push(systemEventText('list_separator'))

    const targetMember = room?.getMember(inviteEvent.targetId)
    const targetName =
      targetMember?.name || inviteEvent.targetFallbackName || fallbackNameFromUserId(inviteEvent.targetId)
    parts.push({ type: 'user', text: targetName, userId: inviteEvent.targetId })
  }

  return {
    kind: 'room_create',
    parts,
  }
}
