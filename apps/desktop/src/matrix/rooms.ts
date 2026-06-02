import type { IPushRule, MatrixEvent, Room } from 'matrix-js-sdk'
import type {} from './matrix-sdk.d'
import type { RoomSummary } from './types'
import type { DesktopEffect } from '@/shared/lib/effect'
import { Effect } from 'effect'
import {
  ConditionKind,
  EventTimeline,
  EventType,
  NotificationCountType,
  Preset,
  PushRuleActionName,
  PushRuleKind,
} from 'matrix-js-sdk'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { getClient } from './client'

const VISIBLE_TYPES = new Set(['m.room.message', 'm.sticker', 'm.room.encrypted'])

function getTimelineEvents(room: Room): MatrixEvent[] {
  const liveTimeline = room.getLiveTimeline?.()
  if (!liveTimeline) return room.timeline ?? []

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

  return events.length > 0 ? events : (room.timeline ?? [])
}

function getLatestVisibleEvent(room: Room) {
  const liveEvents = getTimelineEvents(room)

  for (let i = liveEvents.length - 1; i >= 0; i--) {
    const event = liveEvents[i]
    if (VISIBLE_TYPES.has(event.getType())) return { event, lastTimeEvent: liveEvents.at(-1) }
  }

  const fallbackEvents = room.timeline ?? []
  for (let i = fallbackEvents.length - 1; i >= 0; i--) {
    const event = fallbackEvents[i]
    if (VISIBLE_TYPES.has(event.getType())) return { event, lastTimeEvent: liveEvents.at(-1) ?? fallbackEvents.at(-1) }
  }

  return {
    event: null,
    lastTimeEvent: liveEvents.at(-1) ?? fallbackEvents.at(-1),
  }
}

export function getRoomEffect(roomId: string): DesktopEffect<Room | null> {
  return fromSync(() => getClient().getRoom(roomId))
}

export function getRoom(roomId: string): Room | null {
  return runDesktopSync(getRoomEffect(roomId))
}

let cachedSummaries: RoomSummary[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 200 // ms

export function invalidateRoomSummariesCacheEffect(): DesktopEffect<void> {
  return fromSync(() => {
    cachedSummaries = null
    cacheTimestamp = 0
  })
}

export function invalidateRoomSummariesCache() {
  return runDesktopSync(invalidateRoomSummariesCacheEffect())
}

export function getRoomSummariesEffect(): DesktopEffect<RoomSummary[]> {
  return fromSync(() => {
    const now = Date.now()
    if (cachedSummaries && now - cacheTimestamp < CACHE_TTL) {
      return cachedSummaries
    }

    const client = getClient()
    const rooms = client.getRooms().filter((room) => room.getMyMembership() === 'join')

    // 从 m.direct account data 获取所有 DM 房间 ID
    const directEvent = client.getAccountData(EventType.Direct)
    const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
    const dmRoomMap = new Map<string, string>() // roomId → dmUserId
    for (const [userId, roomIds] of Object.entries(directContent)) {
      if (Array.isArray(roomIds)) {
        for (const rid of roomIds) {
          dmRoomMap.set(rid, userId)
        }
      }
    }

    const result = rooms
      .map((room): RoomSummary => {
        const { event: lastEvent, lastTimeEvent } = getLatestVisibleEvent(room)

        const members = room.getJoinedMembers().map((m) => m.userId)
        const dmUserId = dmRoomMap.get(room.roomId)

        const sender = lastEvent?.getSender()
        const senderMember = sender ? room.getMember(sender) : null
        const senderName = senderMember?.name || sender?.split(':')[0]?.slice(1)

        const dmMember = dmUserId ? room.getMember(dmUserId) : null
        const dmUserAvatar = dmMember?.getMxcAvatarUrl() || undefined

        // 置顶: m.favourite tag
        const tags = room.tags || {}
        const isPinned = 'm.favourite' in tags

        // 免打扰: 检查 push rules override
        const pushRules = client.pushRules
        const overrides = pushRules?.global?.override || []
        const isMuted = overrides.some(
          (rule: IPushRule) =>
            rule.rule_id === room.roomId && rule.actions?.length === 1 && rule.actions[0] === 'dont_notify',
        )

        const highlightCount = room.getUnreadNotificationCount(NotificationCountType.Highlight) || 0
        const memberCount = room.getJoinedMemberCount() || members.length

        return {
          roomId: room.roomId,
          name: room.name || 'Unnamed',
          avatar: room.getMxcAvatarUrl() || undefined,
          lastMessage: lastEvent?.getContent()?.body,
          lastMessageTs: lastEvent?.getTs() ?? lastTimeEvent?.getTs(),
          lastMessageSender: senderName,
          lastMessageType: lastEvent?.getContent()?.msgtype ?? lastEvent?.getType(),
          unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total) || 0,
          isDirect: !!dmUserId,
          isEncrypted: client.isRoomEncrypted(room.roomId),
          members,
          dmUserId: dmUserId || undefined,
          dmUserAvatar,
          isPinned,
          isMuted,
          highlightCount,
          memberCount,
        }
      })
      .sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0))

    cachedSummaries = result
    cacheTimestamp = now
    return result
  })
}

export function getRoomSummaries(): RoomSummary[] {
  return runDesktopSync(getRoomSummariesEffect())
}

/** 切换置顶 (m.favourite tag) */
export function toggleRoomPinEffect(roomId: string): DesktopEffect<boolean> {
  return Effect.gen(function* () {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room) return false
    const tags = room.tags || {}
    const isPinned = 'm.favourite' in tags
    if (isPinned) {
      yield* fromPromise(() => client.deleteRoomTag(roomId, 'm.favourite'))
    } else {
      yield* fromPromise(() => client.setRoomTag(roomId, 'm.favourite', { order: 0.5 }))
    }
    return !isPinned
  })
}

export function toggleRoomPin(roomId: string): Promise<boolean> {
  return runDesktopEffect(toggleRoomPinEffect(roomId))
}

/** 切换免打扰 (push rule override) */
export function toggleRoomMuteEffect(roomId: string): DesktopEffect<boolean> {
  return Effect.gen(function* () {
    const client = getClient()
    const pushRules = client.pushRules
    const overrides = pushRules?.global?.override || []
    const existing = overrides.find((r: IPushRule) => r.rule_id === roomId)

    if (existing) {
      yield* fromPromise(() => client.deletePushRule('global', PushRuleKind.Override, roomId))
      return false
    }

    yield* fromPromise(() =>
      client.addPushRule('global', PushRuleKind.Override, roomId, {
        conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
        actions: [PushRuleActionName.DontNotify],
      }),
    )
    return true
  })
}

export function toggleRoomMute(roomId: string): Promise<boolean> {
  return runDesktopEffect(toggleRoomMuteEffect(roomId))
}

/** 标记房间最新可见事件为已读 */
export function markRoomAsReadEffect(roomId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room) return

    const { event, lastTimeEvent } = getLatestVisibleEvent(room)
    const markerEvent = lastTimeEvent ?? event
    const markerEventId = markerEvent?.getId()
    if (!markerEvent || !markerEventId) return

    yield* fromPromise(() => client.setRoomReadMarkers(roomId, markerEventId, event ?? markerEvent))
    yield* invalidateRoomSummariesCacheEffect()
  })
}

export function markRoomAsRead(roomId: string): Promise<void> {
  return runDesktopEffect(markRoomAsReadEffect(roomId))
}

/** 退出房间 */
export function leaveRoomEffect(roomId: string): DesktopEffect<void> {
  return fromPromise(() => getClient().leave(roomId)).pipe(Effect.asVoid)
}

export function leaveRoom(roomId: string): Promise<void> {
  return runDesktopEffect(leaveRoomEffect(roomId))
}

/** 查找已有的 DM 房间，没有则创建一个新的 */
export function findOrCreateDmEffect(userId: string): DesktopEffect<string> {
  return Effect.gen(function* () {
    const client = getClient()

    // 从 m.direct account data 查找已有的 DM 房间
    const directEvent = client.getAccountData(EventType.Direct)
    const directContent: Record<string, string[]> = directEvent?.getContent() ?? {}
    const existingRoomIds = directContent[userId] || []

    // 1) 找一个自己已加入的 DM 房间
    for (const rid of existingRoomIds) {
      const room = client.getRoom(rid)
      if (room && room.getMyMembership() === 'join') {
        return rid
      }
    }

    // 2) 尝试 rejoin 已离开的 DM 房间（保留历史消息）
    for (const rid of existingRoomIds) {
      const room = client.getRoom(rid)
      const membership = room?.getMyMembership()
      // 房间在本地 store 中且状态是 leave，或者房间不在本地 store（仅在 m.direct 中有记录）
      if (!room || membership === 'leave') {
        const joinedRoomId = yield* fromPromise(() => client.joinRoom(rid)).pipe(
          Effect.map(() => rid),
          Effect.catchAll(() => Effect.succeed(null)),
        )
        if (joinedRoomId) return joinedRoomId
      }
    }

    // 3) m.direct 里没找到可用房间，遍历所有已加入的房间查找与目标用户的 1:1 DM
    const myUserId = client.getUserId()
    const allRooms = client.getRooms()
    for (const room of allRooms) {
      if (room.getMyMembership() !== 'join') continue
      const members = room.getJoinedMembers()
      // 1:1 房间：正好两个成员，一个是自己，一个是目标用户
      if (
        members.length === 2 &&
        members.some((m) => m.userId === userId) &&
        members.some((m) => m.userId === myUserId)
      ) {
        // 将找到的房间补充写入 m.direct，保持数据一致
        const updated = { ...directContent }
        updated[userId] = [...(updated[userId] || []), room.roomId]
        yield* fromPromise(() => client.setAccountData(EventType.Direct, updated))
        return room.roomId
      }
    }

    // 4) 没有已有的 DM 房间，创建一个
    const { room_id } = yield* fromPromise(() =>
      client.createRoom({
        is_direct: true,
        invite: [userId],
        preset: Preset.TrustedPrivateChat,
      }),
    )

    // 更新 m.direct account data
    const updated = { ...directContent }
    updated[userId] = [...(updated[userId] || []), room_id]
    yield* fromPromise(() => client.setAccountData(EventType.Direct, updated))

    return room_id
  })
}

export function findOrCreateDm(userId: string): Promise<string> {
  return runDesktopEffect(findOrCreateDmEffect(userId))
}

/** 修改房间名称 */
export function setRoomNameEffect(roomId: string, name: string): DesktopEffect<void> {
  return fromPromise(() => getClient().setRoomName(roomId, name)).pipe(Effect.asVoid)
}

export function setRoomName(roomId: string, name: string): Promise<void> {
  return runDesktopEffect(setRoomNameEffect(roomId, name))
}

/** 修改房间话题/描述 */
export function setRoomTopicEffect(roomId: string, topic: string): DesktopEffect<void> {
  return fromPromise(() => getClient().setRoomTopic(roomId, topic)).pipe(Effect.asVoid)
}

export function setRoomTopic(roomId: string, topic: string): Promise<void> {
  return runDesktopEffect(setRoomTopicEffect(roomId, topic))
}

/** 修改群头像：上传文件后写入 m.room.avatar 状态事件 */
export function setRoomAvatarEffect(roomId: string, file: File): DesktopEffect<void> {
  return fromPromise(async () => {
    const client = getClient()
    const { content_uri } = await client.uploadContent(file, { type: file.type })
    await client.sendStateEvent(roomId, 'm.room.avatar', { url: content_uri }, '')
  }).pipe(Effect.asVoid)
}

export function setRoomAvatar(roomId: string, file: File): Promise<void> {
  return runDesktopEffect(setRoomAvatarEffect(roomId, file))
}

/** 获取房间话题 */
export function getRoomTopicEffect(roomId: string): DesktopEffect<string> {
  return fromSync(() => {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room) return ''
    const topicEvent = room.currentState.getStateEvents('m.room.topic', '')
    return topicEvent?.getContent()?.topic || ''
  })
}

export function getRoomTopic(roomId: string): string {
  return runDesktopSync(getRoomTopicEffect(roomId))
}

/** 设置房间公告（使用 m.room.pinned_events + 自定义 state event） */
export function setRoomAnnouncementEffect(roomId: string, announcement: string): DesktopEffect<void> {
  return fromPromise(() => getClient().sendStateEvent(roomId, 'im.muon.announcement', { body: announcement })).pipe(
    Effect.asVoid,
  )
}

export function setRoomAnnouncement(roomId: string, announcement: string): Promise<void> {
  return runDesktopEffect(setRoomAnnouncementEffect(roomId, announcement))
}

/** 获取房间公告 */
export function getRoomAnnouncementEffect(roomId: string): DesktopEffect<string> {
  return fromSync(() => {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room) return ''
    const event = room.currentState.getStateEvents('im.muon.announcement', '')
    return event?.getContent()?.body || ''
  })
}

export function getRoomAnnouncement(roomId: string): string {
  return runDesktopSync(getRoomAnnouncementEffect(roomId))
}

// 消失消息 — 通过 im.muon.message_retention state event
export function setMessageRetentionEffect(roomId: string, maxLifetimeMs: number | null): DesktopEffect<void> {
  const content =
    maxLifetimeMs === null
      ? { enabled: false }
      : {
          enabled: true,
          max_lifetime: maxLifetimeMs,
        }
  return fromPromise(() => getClient().sendStateEvent(roomId, 'im.muon.message_retention', content)).pipe(Effect.asVoid)
}

export function setMessageRetention(roomId: string, maxLifetimeMs: number | null): Promise<void> {
  return runDesktopEffect(setMessageRetentionEffect(roomId, maxLifetimeMs))
}

export function getMessageRetentionEffect(
  roomId: string,
): DesktopEffect<{ enabled: boolean; maxLifetime: number } | null> {
  return fromSync(() => {
    const room = getClient().getRoom(roomId)
    if (!room) return null
    const event = room.currentState.getStateEvents('im.muon.message_retention', '')
    if (!event) return null
    const content = event.getContent()
    return { enabled: content.enabled ?? false, maxLifetime: content.max_lifetime ?? 0 }
  })
}

export function getMessageRetention(roomId: string): { enabled: boolean; maxLifetime: number } | null {
  return runDesktopSync(getMessageRetentionEffect(roomId))
}

// --- 消息置顶 (m.room.pinned_events) ---

/** 获取房间中已置顶的消息 eventId 列表 */
function getPinnedEventIdsEffect(roomId: string): DesktopEffect<string[]> {
  return fromSync(() => {
    const room = getClient().getRoom(roomId)
    if (!room) return []
    const pinEvent = room.currentState.getStateEvents('m.room.pinned_events', '')
    return pinEvent?.getContent()?.pinned || []
  })
}

/** 置顶一条消息 */
export function pinMessageEffect(roomId: string, eventId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const current = yield* getPinnedEventIdsEffect(roomId)
    if (current.includes(eventId)) return
    yield* fromPromise(() =>
      getClient().sendStateEvent(roomId, EventType.RoomPinnedEvents, {
        pinned: [...current, eventId],
      }),
    )
  })
}

export function pinMessage(roomId: string, eventId: string): Promise<void> {
  return runDesktopEffect(pinMessageEffect(roomId, eventId))
}

/** 取消置顶一条消息 */
export function unpinMessageEffect(roomId: string, eventId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const current = yield* getPinnedEventIdsEffect(roomId)
    if (!current.includes(eventId)) return
    yield* fromPromise(() =>
      getClient().sendStateEvent(roomId, EventType.RoomPinnedEvents, {
        pinned: current.filter((id) => id !== eventId),
      }),
    )
  })
}

export function unpinMessage(roomId: string, eventId: string): Promise<void> {
  return runDesktopEffect(unpinMessageEffect(roomId, eventId))
}

/** 检查消息是否已置顶 */
export function isMessagePinnedEffect(roomId: string, eventId: string): DesktopEffect<boolean> {
  return Effect.map(getPinnedEventIdsEffect(roomId), (ids) => ids.includes(eventId))
}

export function isMessagePinned(roomId: string, eventId: string): boolean {
  return runDesktopSync(isMessagePinnedEffect(roomId, eventId))
}

// --- 消息收藏 (使用 im.muon.starred account data) ---

/** 获取当前用户的所有收藏消息 */
function getStarredMessagesEffect(): DesktopEffect<{ roomId: string; eventId: string }[]> {
  return fromSync(() => {
    const client = getClient()
    const event = client.getAccountData('im.muon.starred')
    return event?.getContent()?.starred || []
  })
}

/** 收藏一条消息 */
export function starMessageEffect(roomId: string, eventId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const current = yield* getStarredMessagesEffect()
    if (current.some((s) => s.roomId === roomId && s.eventId === eventId)) return
    yield* fromPromise(() =>
      client.setAccountData('im.muon.starred', {
        starred: [...current, { roomId, eventId }],
      }),
    )
  })
}

export function starMessage(roomId: string, eventId: string): Promise<void> {
  return runDesktopEffect(starMessageEffect(roomId, eventId))
}

/** 取消收藏一条消息 */
export function unstarMessageEffect(roomId: string, eventId: string): DesktopEffect<void> {
  return Effect.gen(function* () {
    const client = getClient()
    const current = yield* getStarredMessagesEffect()
    yield* fromPromise(() =>
      client.setAccountData('im.muon.starred', {
        starred: current.filter((s) => !(s.roomId === roomId && s.eventId === eventId)),
      }),
    )
  })
}

export function unstarMessage(roomId: string, eventId: string): Promise<void> {
  return runDesktopEffect(unstarMessageEffect(roomId, eventId))
}

/** 检查消息是否已收藏 */
export function isMessageStarredEffect(roomId: string, eventId: string): DesktopEffect<boolean> {
  return Effect.map(getStarredMessagesEffect(), (starred) =>
    starred.some((s) => s.roomId === roomId && s.eventId === eventId),
  )
}

export function isMessageStarred(roomId: string, eventId: string): boolean {
  return runDesktopSync(isMessageStarredEffect(roomId, eventId))
}

/** 获取当前用户的所有收藏消息 (跨房间)，供收藏面板按房间过滤渲染 */
export function getStarredMessages(): { roomId: string; eventId: string }[] {
  return runDesktopSync(getStarredMessagesEffect())
}

// --- 语音频道状态 (im.muon.voice_channel) ---

/** 设置房间的语音频道状态 */
export function setVoiceChannelStateEffect(roomId: string, enabled: boolean): DesktopEffect<void> {
  return fromPromise(() => getClient().sendStateEvent(roomId, 'im.muon.voice_channel', { enabled })).pipe(Effect.asVoid)
}

export function setVoiceChannelState(roomId: string, enabled: boolean): Promise<void> {
  return runDesktopEffect(setVoiceChannelStateEffect(roomId, enabled))
}

/** 获取房间的语音频道状态 */
export function getVoiceChannelStateEffect(roomId: string): DesktopEffect<{ enabled: boolean } | null> {
  return fromSync(() => {
    const room = getClient().getRoom(roomId)
    if (!room) return null
    const event = room.currentState.getStateEvents('im.muon.voice_channel', '')
    if (!event) return null
    const content = event.getContent()
    return { enabled: content.enabled ?? false }
  })
}

export function getVoiceChannelState(roomId: string): { enabled: boolean } | null {
  return runDesktopSync(getVoiceChannelStateEffect(roomId))
}
