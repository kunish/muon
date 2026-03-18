import type { MatrixEvent } from 'matrix-js-sdk'
import type { RoomMessageEventContent, StickerEventContent } from 'matrix-js-sdk/lib/@types/events'
import type { VideoInfo } from 'matrix-js-sdk/lib/@types/media'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { getClient } from './client'
import { uploadMedia } from './media'

const MENTION_SPAN_RE = /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>@?([^<]*)<\/span>/g

/**
 * 将 TipTap mention HTML 转换为 Matrix 格式
 * TipTap: <span data-type="mention" data-id="@user:server" class="mention">@DisplayName</span>
 * Matrix: <a href="https://matrix.to/#/@user:server">DisplayName</a>
 */
function convertMentionsToMatrix(html: string): { html: string, userIds: string[] } {
  const userIds: string[] = []
  const converted = html.replace(
    MENTION_SPAN_RE,
    (_match, userId: string, label: string) => {
      if (userId && !userIds.includes(userId)) {
        userIds.push(userId)
      }
      return `<a href="https://matrix.to/#/${userId}">${label}</a>`
    },
  )
  return { html: converted, userIds }
}

export async function sendTextMessage(roomId: string, body: string, html?: string): Promise<string> {
  let content: RoomMessageEventContent = { msgtype: MsgType.Text, body }

  if (html && html !== `<p>${body}</p>`) {
    const { html: matrixHtml, userIds } = convertMentionsToMatrix(html)
    content = {
      ...content,
      format: 'org.matrix.custom.html',
      formatted_body: matrixHtml,
      // 添加 m.mentions 用于通知被提及的用户
      ...(userIds.length > 0 ? { 'm.mentions': { user_ids: userIds } } : {}),
    } as RoomMessageEventContent
  }

  const res = await getClient().sendMessage(roomId, content)
  return res.event_id
}

export async function sendImageMessage(roomId: string, file: File): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Image,
    body: file.name,
    url: mxcUrl,
    info: { mimetype: file.type, size: file.size },
  })
  return res.event_id
}

export async function sendFileMessage(roomId: string, file: File): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.File,
    body: file.name,
    url: mxcUrl,
    info: { mimetype: file.type, size: file.size },
  })
  return res.event_id
}

export async function sendVideoMessage(
  roomId: string,
  file: File,
  meta?: { thumbnail: Blob, width: number, height: number, duration: number },
): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const info: VideoInfo = { mimetype: file.type, size: file.size }
  if (meta) {
    info.w = meta.width
    info.h = meta.height
    info.duration = meta.duration
    info.thumbnail_url = await uploadMedia(meta.thumbnail)
    info.thumbnail_info = {
      mimetype: 'image/jpeg',
      w: meta.width,
      h: meta.height,
    }
  }
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Video,
    body: file.name,
    url: mxcUrl,
    info,
  } as RoomMessageEventContent)
  return res.event_id
}

export async function sendAudioMessage(roomId: string, file: Blob, duration: number): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Audio,
    body: 'Voice message',
    url: mxcUrl,
    info: { mimetype: file.type, size: file.size, duration },
  } as RoomMessageEventContent)
  return res.event_id
}

export async function editMessage(roomId: string, eventId: string, newBody: string): Promise<void> {
  await getClient().sendMessage(roomId, {
    'msgtype': MsgType.Text,
    'body': `* ${newBody}`,
    'm.new_content': { msgtype: MsgType.Text, body: newBody },
    'm.relates_to': { rel_type: RelationType.Replace, event_id: eventId },
  } as RoomMessageEventContent)
}

export async function redactMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
  await getClient().redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
}

export async function replyToMessage(roomId: string, eventId: string, body: string): Promise<void> {
  await getClient().sendMessage(roomId, {
    'msgtype': MsgType.Text,
    'body': body,
    'm.relates_to': { 'm.in_reply_to': { event_id: eventId } },
  })
}

/** 可见的内容事件类型 */
const CONTENT_TYPES = new Set([
  'm.room.message',
  'm.sticker',
  'm.room.encrypted',
])

/** 飞书风格：需要在聊天中展示的系统事件类型 */
const SYSTEM_EVENT_TYPES = new Set([
  'm.room.member', // 入群/退群/被踢/改名/改头像
  'm.room.name', // 群名变更
  'm.room.topic', // 群话题变更
  'm.room.avatar', // 群头像变更
  'm.room.create', // 房间创建
])

export function getTimeline(roomId: string, limit = 50): MatrixEvent[] {
  const room = getClient().getRoom(roomId)
  if (!room)
    return []

  return room.getLiveTimeline().getEvents().filter((ev) => {
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

    // 系统事件（飞书风格：入群/退群/改名等展示为系统提示）
    if (SYSTEM_EVENT_TYPES.has(evType)) {
      // m.room.member: 仅保留 join/leave/ban/invite 等有意义的变更
      if (evType === 'm.room.member') {
        const membership = ev.getContent()?.membership
        const prevMembership = ev.getPrevContent()?.membership
        // 过滤无实际变更的事件（如仅更新 display name）
        if (membership === prevMembership) {
          // 但如果改了名字或头像，仍需显示
          const prevName = ev.getPrevContent()?.displayname
          const newName = ev.getContent()?.displayname
          const prevAvatar = ev.getPrevContent()?.avatar_url
          const newAvatar = ev.getContent()?.avatar_url
          if (prevName === newName && prevAvatar === newAvatar)
            return false
        }
        return true
      }
      return true
    }

    return false
  }).slice(-limit)
}

/** 判断事件是否为系统事件（用于 UI 渲染区分） */
export function isSystemEvent(ev: MatrixEvent): boolean {
  return SYSTEM_EVENT_TYPES.has(ev.getType())
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
  kind: 'join' | 'leave' | 'kick' | 'ban' | 'invite' | 'rename' | 'avatar' | 'room_name' | 'room_topic' | 'room_avatar' | 'room_create' | 'unknown'
  /** 结构化描述片段列表 */
  parts: SystemEventPart[]
}

/** 获取系统事件的结构化描述（用于丰富渲染） */
export function getSystemEventInfo(ev: MatrixEvent): SystemEventInfo {
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
    const targetName = targetMember?.name || ev.getContent()?.displayname || targetId.split(':')[0]?.slice(1) || targetId

    // 改名（membership 未变）
    if (membership === prevMembership) {
      const prevName = ev.getPrevContent()?.displayname
      const newName = ev.getContent()?.displayname
      if (prevName !== newName && prevName && newName) {
        return {
          kind: 'rename',
          parts: [
            { type: 'user', text: prevName, userId: targetId },
            { type: 'text', text: ' 更名为 ' },
            { type: 'highlight', text: newName },
          ],
        }
      }
      return {
        kind: 'avatar',
        parts: [
          { type: 'user', text: targetName, userId: targetId },
          { type: 'text', text: ' 更换了头像' },
        ],
      }
    }

    // 加入
    if (membership === 'join' && prevMembership !== 'join') {
      if (sender === targetId) {
        // 自己加入（通过链接等）
        return {
          kind: 'join',
          parts: [
            { type: 'user', text: targetName, userId: targetId },
            { type: 'text', text: ' 加入了群聊' },
          ],
        }
      }
      // 被邀请加入
      return {
        kind: 'join',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          { type: 'text', text: ' 邀请 ' },
          { type: 'user', text: targetName, userId: targetId },
          { type: 'text', text: ' 加入了群聊' },
        ],
      }
    }

    // 离开
    if (membership === 'leave') {
      if (sender === targetId) {
        return {
          kind: 'leave',
          parts: [
            { type: 'user', text: targetName, userId: targetId },
            { type: 'text', text: ' 退出了群聊' },
          ],
        }
      }
      // 被踢出
      return {
        kind: 'kick',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          { type: 'text', text: ' 将 ' },
          { type: 'user', text: targetName, userId: targetId },
          { type: 'text', text: ' 移出了群聊' },
        ],
      }
    }

    // 被封禁
    if (membership === 'ban') {
      return {
        kind: 'ban',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          { type: 'text', text: ' 将 ' },
          { type: 'user', text: targetName, userId: targetId },
          { type: 'text', text: ' 禁止加入群聊' },
        ],
      }
    }

    // 邀请（还未加入）
    if (membership === 'invite') {
      return {
        kind: 'invite',
        parts: [
          { type: 'user', text: senderName, userId: sender },
          { type: 'text', text: ' 邀请了 ' },
          { type: 'user', text: targetName, userId: targetId },
        ],
      }
    }

    return {
      kind: 'unknown',
      parts: [
        { type: 'user', text: targetName, userId: targetId },
        { type: 'text', text: ' 的成员状态已变更' },
      ],
    }
  }

  if (evType === 'm.room.name') {
    const newName = ev.getContent()?.name || ''
    return {
      kind: 'room_name',
      parts: [
        { type: 'user', text: senderName, userId: sender },
        { type: 'text', text: ' 将群名改为 ' },
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
        { type: 'text', text: ' 将群话题改为 ' },
        { type: 'highlight', text: `"${newTopic}"` },
      ],
    }
  }

  if (evType === 'm.room.avatar') {
    return {
      kind: 'room_avatar',
      parts: [
        { type: 'user', text: senderName, userId: sender },
        { type: 'text', text: ' 更换了群头像' },
      ],
    }
  }

  if (evType === 'm.room.create') {
    return {
      kind: 'room_create',
      parts: [
        { type: 'user', text: senderName, userId: sender },
        { type: 'text', text: ' 创建了此群聊' },
      ],
    }
  }

  return {
    kind: 'unknown',
    parts: [
      { type: 'user', text: senderName, userId: sender },
      { type: 'text', text: ' 触发了一个事件' },
    ],
  }
}

export async function paginateBack(roomId: string, count = 20): Promise<boolean> {
  const room = getClient().getRoom(roomId)
  if (!room)
    return false
  return getClient().paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: count })
}

/** 发送 GIF 消息（作为 m.image，mimetype 标记为 image/gif） */
export async function sendGifMessage(
  roomId: string,
  url: string,
  width: number,
  height: number,
): Promise<string> {
  let gifBlob: Blob

  try {
    const res = await tauriFetch(url)
    if (!res.ok) {
      throw new Error(`GIF fetch failed: ${res.status}`)
    }
    const buf = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/gif'
    gifBlob = new Blob([buf], { type: contentType })
  }
  catch {
    // Fallback: browser fetch (for environments where plugin-http is unavailable)
    const resp = await fetch(url)
    if (!resp.ok)
      throw new Error(`GIF fetch failed: ${resp.status}`)
    gifBlob = await resp.blob()
  }

  const mxcUrl = await uploadMedia(gifBlob)

  const res = await getClient().sendMessage(roomId, {
    'msgtype': MsgType.Image,
    'body': 'GIF',
    'url': mxcUrl,
    'info': {
      mimetype: 'image/gif',
      size: gifBlob.size,
      w: width,
      h: height,
    },
    'xyz.muon.gif_source': url,
  } as RoomMessageEventContent)
  return res.event_id
}

/** 发送 emoji 贴纸消息 */
export async function sendStickerMessage(roomId: string, emoji: string, name: string): Promise<string> {
  const res = await getClient().sendEvent(roomId, EventType.Sticker, {
    body: name,
    url: '',
    info: {
      'mimetype': 'text/plain',
      'xyz.muon.emoji': emoji,
    },
  } as StickerEventContent)
  return res.event_id
}

/** 发送图片贴纸消息 */
export async function sendImageStickerMessage(
  roomId: string,
  name: string,
  mxcUrl: string,
  info: { w: number, h: number, mimetype: string, size?: number },
): Promise<string> {
  const res = await getClient().sendEvent(roomId, EventType.Sticker, {
    body: name,
    url: mxcUrl,
    info: {
      w: info.w,
      h: info.h,
      mimetype: info.mimetype,
      size: info.size ?? 0,
    },
  } as StickerEventContent)
  return res.event_id
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

export async function sendLocationMessage(
  roomId: string,
  latitude: number,
  longitude: number,
  description?: string,
): Promise<string> {
  const geoUri = `geo:${latitude},${longitude}`
  const body = description || `Location: ${latitude}, ${longitude}`
  const { event_id } = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Location,
    body,
    geo_uri: geoUri,
    info: {
      description: body,
    },
  } as RoomMessageEventContent)
  return event_id
}

/** 获取某条消息的 thread 回复列表 */
export function getThreadReplies(roomId: string, threadRootId: string): MatrixEvent[] {
  const timeline = getTimeline(roomId)
  return timeline.filter((e) => {
    const rel = e.getContent()?.['m.relates_to']
    return rel?.rel_type === 'm.thread' && rel?.event_id === threadRootId
  })
}

/** 在 thread 中发送回复 */
export async function sendThreadReply(
  roomId: string,
  threadRootId: string,
  body: string,
): Promise<string> {
  const { event_id } = await getClient().sendMessage(roomId, {
    'msgtype': MsgType.Text,
    body,
    'm.relates_to': {
      'rel_type': 'm.thread',
      'event_id': threadRootId,
      'is_falling_back': true,
      'm.in_reply_to': { event_id: threadRootId },
    },
  } as RoomMessageEventContent)
  return event_id
}

/** 合并转发多条消息到目标房间 */
export async function forwardMessages(
  roomId: string,
  targetRoomId: string,
  eventIds: string[],
): Promise<string> {
  const timeline = getTimeline(roomId)
  const events = eventIds
    .map(id => timeline.find(e => e.getId() === id))
    .filter(Boolean)

  const bodies = events.map((e) => {
    const sender = e!.getSender() || 'Unknown'
    const body = e!.getContent().body || ''
    return `${sender}: ${body}`
  })

  const htmlBodies = events.map((e) => {
    const sender = e!.getSender() || 'Unknown'
    const body = e!.getContent().body || ''
    return `<p><strong>${sender}</strong>: ${body}</p>`
  })

  const { event_id } = await getClient().sendMessage(targetRoomId, {
    msgtype: MsgType.Text,
    body: `[Forwarded] ${events.length} messages\n---\n${bodies.join('\n')}`,
    format: 'org.matrix.custom.html',
    formatted_body: `<blockquote><p><strong>[Forwarded] ${events.length} messages</strong></p>${htmlBodies.join('')}</blockquote>`,
  })
  return event_id
}

/** 发送名片消息 */
export async function sendContactCard(
  roomId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
): Promise<string> {
  const { event_id } = await getClient().sendMessage(roomId, {
    'msgtype': 'im.muon.contact_card',
    'body': `[Contact] ${displayName}`,
    'im.muon.contact_card': {
      user_id: userId,
      display_name: displayName,
      avatar_url: avatarUrl || '',
    },
  } as unknown as RoomMessageEventContent)
  return event_id
}

/** 获取事件的 reactions 汇总 */
export function getReactions(roomId: string, eventId: string): { key: string, count: number, myReaction: boolean }[] {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return []

  const userId = client.getUserId()
  const reactionMap = new Map<string, { count: number, myReaction: boolean }>()

  // 遍历 timeline 找到所有 reaction 事件
  const events = room.getLiveTimeline().getEvents()
  for (const ev of events) {
    if (ev.getType() !== 'm.reaction')
      continue
    if (ev.isRedacted())
      continue
    const rel = ev.getContent()?.['m.relates_to']
    if (rel?.event_id !== eventId || rel?.rel_type !== RelationType.Annotation)
      continue
    const key = rel.key
    if (!key)
      continue
    const existing = reactionMap.get(key) || { count: 0, myReaction: false }
    existing.count++
    if (ev.getSender() === userId)
      existing.myReaction = true
    reactionMap.set(key, existing)
  }

  return Array.from(reactionMap.entries()).map(([key, val]) => ({
    key,
    count: val.count,
    myReaction: val.myReaction,
  }))
}
