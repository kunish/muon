import type { MatrixEvent, Room } from 'matrix-js-sdk'
import type { RoomMessageEventContent, StickerEventContent } from 'matrix-js-sdk/lib/@types/events'
import type { VideoInfo } from 'matrix-js-sdk/lib/@types/media'
import { htmlToPlainText, sanitizeMatrixHtml } from '@muon/rich-text'
import { EventTimeline, EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { fetch as desktopFetch } from '@/electron/http'
import { localizedText } from '@/shared/lib/localizedText'
import { getClient } from './client'
import { extractImageMeta, uploadMedia } from './media'

const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g
const RE_QUOT = /"/g

function escapeHtml(text: string): string {
  return text.replace(RE_AMP, '&amp;').replace(RE_LT, '&lt;').replace(RE_GT, '&gt;').replace(RE_QUOT, '&quot;')
}

const MENTION_SPAN_RE = /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>@?([^<]*)<\/span>/g
const NON_PLAIN_HTML_RE = /<(?:[abisu]|blockquote|code|del|em|h[1-6]|img|li|ol|pre|span|strong|ul)[\s>/]/i
const MATRIX_HTML_FORMAT = 'org.matrix.custom.html' as const

interface MatrixTextContent {
  'msgtype': MsgType.Text
  'body': string
  'format'?: typeof MATRIX_HTML_FORMAT
  'formatted_body'?: string
  'm.mentions'?: { user_ids: string[] }
}

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
  const content = createTextMessageContent(body, html)
  const res = await getClient().sendMessage(roomId, content as RoomMessageEventContent)
  return res.event_id
}

function createTextMessageContent(body: string, html?: string): MatrixTextContent {
  if (html && !isPlainEditorHtml(html, body)) {
    const { html: matrixHtml, userIds } = convertMentionsToMatrix(html)
    const formattedBody = sanitizeMatrixHtml(matrixHtml)
    return {
      msgtype: MsgType.Text,
      body,
      format: MATRIX_HTML_FORMAT,
      formatted_body: formattedBody,
      // 添加 m.mentions 用于通知被提及的用户
      ...(userIds.length > 0 ? { 'm.mentions': { user_ids: userIds } } : {}),
    }
  }

  return { msgtype: MsgType.Text, body }
}

function isPlainEditorHtml(html: string, body: string): boolean {
  return !NON_PLAIN_HTML_RE.test(html) && htmlToPlainText(html) === body.trim()
}

export async function sendImageMessage(roomId: string, file: File): Promise<string> {
  let meta: { width: number, height: number } | null = null
  try {
    meta = await extractImageMeta(file)
  }
  catch (e) {
    console.warn('[upload] failed to extract image meta', e)
  }
  const mxcUrl = await uploadMedia(file)
  const info: { mimetype: string, size: number, w?: number, h?: number } = {
    mimetype: file.type,
    size: file.size,
  }
  if (meta) {
    info.w = meta.width
    info.h = meta.height
  }
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Image,
    body: file.name,
    url: mxcUrl,
    info,
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

export async function editMessage(roomId: string, eventId: string, newBody: string, html?: string): Promise<void> {
  const newContent = createTextMessageContent(newBody, html)
  const replacementContent: MatrixTextContent = {
    ...newContent,
    body: `* ${newContent.body}`,
  }

  if (replacementContent.formatted_body)
    replacementContent.formatted_body = prefixEditedFormattedBody(replacementContent.formatted_body)

  await getClient().sendMessage(roomId, {
    ...replacementContent,
    'm.new_content': newContent,
    'm.relates_to': { rel_type: RelationType.Replace, event_id: eventId },
  } as RoomMessageEventContent)
}

function prefixEditedFormattedBody(formattedBody: string): string {
  const paragraphIndex = formattedBody.indexOf('<p>')
  if (paragraphIndex >= 0) {
    return `${formattedBody.slice(0, paragraphIndex)}${formattedBody.slice(paragraphIndex).replace('<p>', '<p>* ')}`
  }
  return `<p>* ${formattedBody}</p>`
}

export async function redactMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
  await getClient().redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)
}

export async function replyToMessage(roomId: string, eventId: string, body: string, html?: string): Promise<void> {
  const content = createTextMessageContent(body, html)
  await getClient().sendMessage(roomId, {
    ...content,
    'm.relates_to': { 'm.in_reply_to': { event_id: eventId } },
  } as RoomMessageEventContent)
}

/** 可见的内容事件类型 */
const CONTENT_TYPES = new Set([
  'm.room.message',
  'm.sticker',
  'm.room.encrypted',
])

/** 飞书风格：需要在聊天中展示的系统事件类型 */
const SYSTEM_EVENT_TYPES = new Set([
  'm.room.member', // 入群/退群/被踢/邀请/封禁
  'm.room.name', // 群名变更
  'm.room.topic', // 群话题变更
  'm.room.create', // 房间创建
])

const DISPLAYABLE_MEMBER_MEMBERSHIPS = new Set(['join', 'leave', 'ban', 'invite'])

export function getTimeline(roomId: string, limit = 50): MatrixEvent[] {
  const room = getClient().getRoom(roomId)
  if (!room)
    return []

  return getLinkedTimelineEvents(room).filter(isDisplayableTimelineEvent).slice(-limit)
}

function getLinkedTimelineEvents(room: Room): MatrixEvent[] {
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

function isDisplayableTimelineEvent(ev: MatrixEvent): boolean {
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

function isDisplayableSystemEvent(ev: MatrixEvent): boolean {
  if (ev.getType() !== 'm.room.member')
    return true

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  if (membership === prevMembership)
    return false

  return typeof membership === 'string' && DISPLAYABLE_MEMBER_MEMBERSHIPS.has(membership)
}

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

export interface ReactionSummary {
  key: string
  count: number
  myReaction: boolean
}

export interface TimelineRelationSummaries {
  reactionsByEventId: Map<string, ReactionSummary[]>
  threadReplyCountsByEventId: Map<string, number>
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
    if (mergedInfo)
      return mergedInfo
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
    const targetName = targetMember?.name || ev.getContent()?.displayname || targetId.split(':')[0]?.slice(1) || targetId

    // 加入
    if (membership === 'join' && prevMembership !== 'join') {
      if (sender === targetId) {
        // 自己加入（通过链接等）
        return {
          kind: 'join',
          parts: [
            { type: 'user', text: targetName, userId: targetId },
            systemEventText('joined_group'),
          ],
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
          parts: [
            { type: 'user', text: targetName, userId: targetId },
            systemEventText('left_group'),
          ],
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
      parts: [
        { type: 'user', text: targetName, userId: targetId },
        systemEventText('membership_changed'),
      ],
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
      parts: [
        { type: 'user', text: senderName, userId: sender },
        systemEventText('created_this_group'),
      ],
    }
  }

  return {
    kind: 'unknown',
    parts: [
      { type: 'user', text: senderName, userId: sender },
      systemEventText('triggered_event'),
    ],
  }
}

const SYSTEM_EVENT_MERGE_WINDOW_MS = 2 * 60 * 1000

function fallbackNameFromUserId(userId: string): string {
  return userId.split(':')[0]?.slice(1) || userId
}

function getMergeableMemberEvent(ev: MatrixEvent): MergeableMemberEvent | null {
  if (ev.getType() !== 'm.room.member')
    return null

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  const roomId = ev.getRoomId()
  const sender = ev.getSender()
  const targetId = ev.getStateKey()
  if (!roomId || !sender || !targetId || sender === targetId)
    return null

  const kind = membership === 'invite'
    ? 'invite'
    : membership === 'join' && prevMembership === 'invite'
      ? 'invite_join'
      : null
  if (!kind)
    return null

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
  if (!roomId || !actor)
    return null

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

  if (evType !== 'm.room.member')
    return null

  const membership = ev.getContent()?.membership
  const prevMembership = ev.getPrevContent()?.membership
  const targetId = ev.getStateKey()
  if (!targetId)
    return null

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
  if (setupEvents.includes(null))
    return false

  const first = setupEvents[0]
  const nextSetup = getRoomCreationSetupEvent(next)
  if (!first || first.kind !== 'create' || !nextSetup || nextSetup.kind === 'create')
    return false

  return [...setupEvents, nextSetup].every(item =>
    item !== null
    && item.roomId === first.roomId
    && item.actor === first.actor
    && Math.abs(item.ts - first.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS,
  )
}

function findLastSetupEvent(
  events: RoomCreationSetupEvent[],
  predicate: (event: RoomCreationSetupEvent) => boolean,
): RoomCreationSetupEvent | undefined {
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index]
    if (predicate(event))
      return event
  }
  return undefined
}

export function canMergeSystemEvents(previous: MatrixEvent | MatrixEvent[], next: MatrixEvent): boolean {
  const previousEvents = Array.isArray(previous) ? previous : [previous]
  const prev = previousEvents.at(-1)
  if (!prev)
    return false

  if (canMergeRoomCreationSetupEvents(previousEvents, next))
    return true

  const prevMerge = getMergeableMemberEvent(prev)
  const nextMerge = getMergeableMemberEvent(next)
  if (!prevMerge || !nextMerge || prevMerge.key !== nextMerge.key)
    return false

  return Math.abs(nextMerge.ts - prevMerge.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS
}

function getMergedSystemEventInfo(events: MatrixEvent[]): SystemEventInfo | null {
  const roomCreationInfo = getMergedRoomCreationSystemEventInfo(events)
  if (roomCreationInfo)
    return roomCreationInfo

  const first = getMergeableMemberEvent(events[0])
  if (!first)
    return null

  const memberEvents = events
    .map(getMergeableMemberEvent)
    .filter((item): item is MergeableMemberEvent => item !== null && item.key === first.key)

  if (memberEvents.length !== events.length || memberEvents.length < 2)
    return null

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
    if (seenTargets.has(memberEvent.targetId))
      continue
    seenTargets.add(memberEvent.targetId)
    if (seenTargets.size > 1)
      parts.push(systemEventText('list_separator'))

    const targetMember = room?.getMember(memberEvent.targetId)
    const targetName = targetMember?.name || memberEvent.targetFallbackName
    parts.push({ type: 'user', text: targetName, userId: memberEvent.targetId })
  }

  if (first.kind === 'invite_join')
    parts.push(systemEventText('to_join_group'))

  return {
    kind: first.kind === 'invite' ? 'invite' : 'join',
    parts,
  }
}

function getMergedRoomCreationSystemEventInfo(events: MatrixEvent[]): SystemEventInfo | null {
  const setupEvents: RoomCreationSetupEvent[] = []
  for (const event of events) {
    const setupEvent = getRoomCreationSetupEvent(event)
    if (!setupEvent)
      return null
    setupEvents.push(setupEvent)
  }

  const first = setupEvents[0]
  if (!first || first.kind !== 'create' || setupEvents.length < 2)
    return null

  if (!setupEvents.every(item =>
    item.roomId === first.roomId
    && item.actor === first.actor
    && Math.abs(item.ts - first.ts) <= SYSTEM_EVENT_MERGE_WINDOW_MS,
  )) {
    return null
  }

  const client = getClient()
  const room = client.getRoom(first.roomId)
  const actorMember = room?.getMember(first.actor)
  const actorName = actorMember?.name || fallbackNameFromUserId(first.actor)
  const roomName = findLastSetupEvent(setupEvents, item => item.kind === 'room_name' && !!item.name)?.name
  const roomTopic = findLastSetupEvent(setupEvents, item => item.kind === 'room_topic' && !!item.topic)?.topic
  const inviteEvents = setupEvents.filter(item => item.kind === 'invite' && item.targetId)

  const parts: SystemEventPart[] = [
    { type: 'user', text: actorName, userId: first.actor },
  ]

  if (roomName) {
    parts.push(
      systemEventText('created_group_named'),
      { type: 'highlight', text: `"${roomName}"` },
    )
  }
  else {
    parts.push(systemEventText('created_this_group'))
  }

  if (roomTopic) {
    parts.push(
      systemEventText('with_topic'),
      { type: 'highlight', text: `"${roomTopic}"` },
    )
  }

  const seenTargets = new Set<string>()
  for (const inviteEvent of inviteEvents) {
    if (!inviteEvent.targetId || seenTargets.has(inviteEvent.targetId))
      continue
    seenTargets.add(inviteEvent.targetId)

    if (seenTargets.size === 1)
      parts.push(systemEventText('and_invited'))
    else
      parts.push(systemEventText('list_separator'))

    const targetMember = room?.getMember(inviteEvent.targetId)
    const targetName = targetMember?.name || inviteEvent.targetFallbackName || fallbackNameFromUserId(inviteEvent.targetId)
    parts.push({ type: 'user', text: targetName, userId: inviteEvent.targetId })
  }

  return {
    kind: 'room_create',
    parts,
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
    const res = await desktopFetch(url)
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
  const room = getClient().getRoom(roomId)
  if (!room)
    return []

  return getLinkedTimelineEvents(room).filter((e) => {
    const rel = e.getContent()?.['m.relates_to']
    return !e.isRedacted()
      && rel?.rel_type === 'm.thread'
      && rel?.event_id === threadRootId
      && isDisplayableTimelineEvent(e)
  })
}

export function getTimelineRelationSummaries(roomId: string): TimelineRelationSummaries {
  const client = getClient()
  const room = client.getRoom(roomId)
  const reactionsByEventId = new Map<string, ReactionSummary[]>()
  const threadReplyCountsByEventId = new Map<string, number>()
  if (!room)
    return { reactionsByEventId, threadReplyCountsByEventId }

  const userId = client.getUserId()
  const reactionBuckets = new Map<string, Map<string, ReactionSummary>>()

  for (const ev of getLinkedTimelineEvents(room)) {
    if (ev.isRedacted())
      continue

    const rel = ev.getContent()?.['m.relates_to']
    const relatedEventId = rel?.event_id
    if (!relatedEventId)
      continue

    if (ev.getType() === 'm.reaction' && rel.rel_type === RelationType.Annotation) {
      const key = rel.key
      if (!key)
        continue

      let eventReactions = reactionBuckets.get(relatedEventId)
      if (!eventReactions) {
        eventReactions = new Map()
        reactionBuckets.set(relatedEventId, eventReactions)
      }

      const existing = eventReactions.get(key) ?? { key, count: 0, myReaction: false }
      existing.count++
      if (ev.getSender() === userId)
        existing.myReaction = true
      eventReactions.set(key, existing)
      continue
    }

    if (rel.rel_type === 'm.thread' && isDisplayableTimelineEvent(ev)) {
      threadReplyCountsByEventId.set(
        relatedEventId,
        (threadReplyCountsByEventId.get(relatedEventId) ?? 0) + 1,
      )
    }
  }

  for (const [eventId, reactions] of reactionBuckets) {
    reactionsByEventId.set(eventId, [...reactions.values()])
  }

  return { reactionsByEventId, threadReplyCountsByEventId }
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
    return `<p><strong>${escapeHtml(sender)}</strong>: ${escapeHtml(body)}</p>`
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
export function getReactions(roomId: string, eventId: string): ReactionSummary[] {
  return getTimelineRelationSummaries(roomId).reactionsByEventId.get(eventId) ?? []
}
