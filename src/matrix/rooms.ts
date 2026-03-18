import type { IPushRule, MatrixEvent, Room } from 'matrix-js-sdk'
import type {} from './matrix-sdk.d'
import type { RoomSummary } from './types'
import { ConditionKind, EventType, NotificationCountType, Preset, PushRuleActionName, PushRuleKind } from 'matrix-js-sdk'
import { getClient } from './client'

const VISIBLE_TYPES = new Set(['m.room.message', 'm.sticker', 'm.room.encrypted'])

function getTimelineEvents(room: Room): MatrixEvent[] {
  return room.getLiveTimeline?.().getEvents?.() ?? room.timeline ?? []
}

function getLatestVisibleEvent(room: Room) {
  const liveEvents = getTimelineEvents(room)

  for (let i = liveEvents.length - 1; i >= 0; i--) {
    const event = liveEvents[i]
    if (VISIBLE_TYPES.has(event.getType()))
      return { event, lastTimeEvent: liveEvents.at(-1) }
  }

  const fallbackEvents = room.timeline ?? []
  for (let i = fallbackEvents.length - 1; i >= 0; i--) {
    const event = fallbackEvents[i]
    if (VISIBLE_TYPES.has(event.getType()))
      return { event, lastTimeEvent: liveEvents.at(-1) ?? fallbackEvents.at(-1) }
  }

  return {
    event: null,
    lastTimeEvent: liveEvents.at(-1) ?? fallbackEvents.at(-1),
  }
}

export function getRoom(roomId: string): Room | null {
  return getClient().getRoom(roomId)
}

export function getRoomSummaries(): RoomSummary[] {
  const client = getClient()
  const rooms = client.getRooms().filter(room => room.getMyMembership() === 'join')

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

  return rooms
    .map((room): RoomSummary => {
      const { event: lastEvent, lastTimeEvent } = getLatestVisibleEvent(room)

      const members = room.getJoinedMembers().map(m => m.userId)
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
      const isMuted = overrides.some((rule: IPushRule) =>
        rule.rule_id === room.roomId
        && rule.actions?.length === 1
        && rule.actions[0] === 'dont_notify',
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
        lastMessageType: lastEvent?.getContent()?.msgtype,
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
}

/** 切换置顶 (m.favourite tag) */
export async function toggleRoomPin(roomId: string): Promise<boolean> {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return false
  const tags = room.tags || {}
  const isPinned = 'm.favourite' in tags
  if (isPinned) {
    await client.deleteRoomTag(roomId, 'm.favourite')
  }
  else {
    await client.setRoomTag(roomId, 'm.favourite', { order: 0.5 })
  }
  return !isPinned
}

/** 切换免打扰 (push rule override) */
export async function toggleRoomMute(roomId: string): Promise<boolean> {
  const client = getClient()
  const pushRules = client.pushRules
  const overrides = pushRules?.global?.override || []
  const existing = overrides.find((r: IPushRule) => r.rule_id === roomId)

  if (existing) {
    await client.deletePushRule('global', PushRuleKind.Override, roomId)
    return false
  }
  else {
    await client.addPushRule('global', PushRuleKind.Override, roomId, {
      conditions: [{ kind: ConditionKind.EventMatch, key: 'room_id', pattern: roomId }],
      actions: [PushRuleActionName.DontNotify],
    })
    return true
  }
}

/** 退出房间 */
export async function leaveRoom(roomId: string): Promise<void> {
  const client = getClient()
  await client.leave(roomId)
}

/** 查找已有的 DM 房间，没有则创建一个新的 */
export async function findOrCreateDm(userId: string): Promise<string> {
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
      try {
        await client.joinRoom(rid)
        return rid
      }
      catch {
        // 可能被 ban、房间已删除等，继续尝试下一个
      }
    }
  }

  // 3) m.direct 里没找到可用房间，遍历所有已加入的房间查找与目标用户的 1:1 DM
  const myUserId = client.getUserId()
  const allRooms = client.getRooms()
  for (const room of allRooms) {
    if (room.getMyMembership() !== 'join')
      continue
    const members = room.getJoinedMembers()
    // 1:1 房间：正好两个成员，一个是自己，一个是目标用户
    if (members.length === 2 && members.some(m => m.userId === userId) && members.some(m => m.userId === myUserId)) {
      // 将找到的房间补充写入 m.direct，保持数据一致
      const updated = { ...directContent }
      updated[userId] = [...(updated[userId] || []), room.roomId]
      await client.setAccountData(EventType.Direct, updated)
      return room.roomId
    }
  }

  // 4) 没有已有的 DM 房间，创建一个
  const { room_id } = await client.createRoom({
    is_direct: true,
    invite: [userId],
    preset: Preset.TrustedPrivateChat,
  })

  // 更新 m.direct account data
  const updated = { ...directContent }
  updated[userId] = [...(updated[userId] || []), room_id]
  await client.setAccountData(EventType.Direct, updated)

  return room_id
}

/** 修改房间名称 */
export async function setRoomName(roomId: string, name: string): Promise<void> {
  const client = getClient()
  await client.setRoomName(roomId, name)
}

/** 修改房间话题/描述 */
export async function setRoomTopic(roomId: string, topic: string): Promise<void> {
  const client = getClient()
  await client.setRoomTopic(roomId, topic)
}

/** 获取房间话题 */
export function getRoomTopic(roomId: string): string {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return ''
  const topicEvent = room.currentState.getStateEvents('m.room.topic', '')
  return topicEvent?.getContent()?.topic || ''
}

/** 设置房间公告（使用 m.room.pinned_events + 自定义 state event） */
export async function setRoomAnnouncement(roomId: string, announcement: string): Promise<void> {
  const client = getClient()
  await client.sendStateEvent(roomId, 'im.muon.announcement', { body: announcement })
}

/** 获取房间公告 */
export function getRoomAnnouncement(roomId: string): string {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return ''
  const event = room.currentState.getStateEvents('im.muon.announcement', '')
  return event?.getContent()?.body || ''
}

// 消失消息 — 通过 im.muon.message_retention state event
export async function setMessageRetention(roomId: string, maxLifetimeMs: number | null): Promise<void> {
  if (maxLifetimeMs === null) {
    await getClient().sendStateEvent(roomId, 'im.muon.message_retention', { enabled: false })
  }
  else {
    await getClient().sendStateEvent(roomId, 'im.muon.message_retention', {
      enabled: true,
      max_lifetime: maxLifetimeMs,
    })
  }
}

export function getMessageRetention(roomId: string): { enabled: boolean, maxLifetime: number } | null {
  const room = getClient().getRoom(roomId)
  if (!room)
    return null
  const event = room.currentState.getStateEvents('im.muon.message_retention', '')
  if (!event)
    return null
  const content = event.getContent()
  return { enabled: content.enabled ?? false, maxLifetime: content.max_lifetime ?? 0 }
}

// --- 消息置顶 (m.room.pinned_events) ---

/** 获取房间中已置顶的消息 eventId 列表 */
function getPinnedEventIds(roomId: string): string[] {
  const room = getClient().getRoom(roomId)
  if (!room)
    return []
  const pinEvent = room.currentState.getStateEvents('m.room.pinned_events', '')
  return pinEvent?.getContent()?.pinned || []
}

/** 置顶一条消息 */
export async function pinMessage(roomId: string, eventId: string): Promise<void> {
  const current = getPinnedEventIds(roomId)
  if (current.includes(eventId))
    return
  await getClient().sendStateEvent(roomId, EventType.RoomPinnedEvents, {
    pinned: [...current, eventId],
  })
}

/** 取消置顶一条消息 */
export async function unpinMessage(roomId: string, eventId: string): Promise<void> {
  const current = getPinnedEventIds(roomId)
  if (!current.includes(eventId))
    return
  await getClient().sendStateEvent(roomId, EventType.RoomPinnedEvents, {
    pinned: current.filter(id => id !== eventId),
  })
}

/** 检查消息是否已置顶 */
export function isMessagePinned(roomId: string, eventId: string): boolean {
  return getPinnedEventIds(roomId).includes(eventId)
}

// --- 消息收藏 (使用 im.muon.starred account data) ---

/** 获取当前用户的所有收藏消息 */
function getStarredMessages(): { roomId: string, eventId: string }[] {
  const client = getClient()
  const event = client.getAccountData('im.muon.starred')
  return event?.getContent()?.starred || []
}

/** 收藏一条消息 */
export async function starMessage(roomId: string, eventId: string): Promise<void> {
  const client = getClient()
  const current = getStarredMessages()
  if (current.some(s => s.roomId === roomId && s.eventId === eventId))
    return
  await client.setAccountData('im.muon.starred', {
    starred: [...current, { roomId, eventId }],
  })
}

/** 取消收藏一条消息 */
export async function unstarMessage(roomId: string, eventId: string): Promise<void> {
  const client = getClient()
  const current = getStarredMessages()
  await client.setAccountData('im.muon.starred', {
    starred: current.filter(s => !(s.roomId === roomId && s.eventId === eventId)),
  })
}

/** 检查消息是否已收藏 */
export function isMessageStarred(roomId: string, eventId: string): boolean {
  return getStarredMessages().some(s => s.roomId === roomId && s.eventId === eventId)
}

// --- 语音频道状态 (im.muon.voice_channel) ---

/** 设置房间的语音频道状态 */
export async function setVoiceChannelState(roomId: string, enabled: boolean): Promise<void> {
  await getClient().sendStateEvent(roomId, 'im.muon.voice_channel', { enabled })
}

/** 获取房间的语音频道状态 */
export function getVoiceChannelState(roomId: string): { enabled: boolean } | null {
  const room = getClient().getRoom(roomId)
  if (!room)
    return null
  const event = room.currentState.getStateEvents('im.muon.voice_channel', '')
  if (!event)
    return null
  const content = event.getContent()
  return { enabled: content.enabled ?? false }
}
