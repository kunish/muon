import type { RoomMessageEventContent, StickerEventContent } from 'matrix-js-sdk/lib/@types/events'
import type { VideoInfo } from 'matrix-js-sdk/lib/@types/media'
import { htmlToPlainText, sanitizeMatrixHtml } from '@muon/rich-text'
import { EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { fetch as desktopFetch } from '@/desktop/http'
import { computeSha256, escapeHtml } from '@/shared/lib/utils'
import { getClient } from '../client'
import { extractImageMeta, uploadMedia } from '../media'
import { getTimeline } from './timeline'

const MENTION_SPAN_RE = /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>@?([^<]*)<\/span>/g
const NON_PLAIN_HTML_RE = /<(?:[abisu]|blockquote|code|del|em|h[1-6]|img|li|ol|pre|span|strong|ul)[\s>/]/i
const MATRIX_HTML_FORMAT = 'org.matrix.custom.html' as const

interface MatrixTextContent {
  'msgtype': MsgType.Text
  'body': string
  'format'?: typeof MATRIX_HTML_FORMAT
  'formatted_body'?: string
  'm.mentions'?: { user_ids: string[] }
  // MSC4019 (unstable). Recognizing clients should suppress notifications and
  // sound; others fall back to normal notifying behavior. Track stabilization at
  // https://github.com/matrix-org/matrix-spec-proposals/pull/4019.
  'org.matrix.msc4019.silent'?: true
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

export interface SendTextOptions {
  silent?: boolean
}

export async function sendTextMessage(
  roomId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): Promise<string> {
  const content = createTextMessageContent(body, html, options)
  const res = await getClient().sendMessage(roomId, content as RoomMessageEventContent)
  return res.event_id
}

function createTextMessageContent(body: string, html?: string, options?: SendTextOptions): MatrixTextContent {
  const silentTag = options?.silent ? ({ 'org.matrix.msc4019.silent': true } as const) : null
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
      ...(silentTag ?? {}),
    }
  }

  return { msgtype: MsgType.Text, body, ...(silentTag ?? {}) }
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
  // Hash for server-side deduplication (秒传)
  let fileHash: string | undefined
  try {
    fileHash = await computeSha256(file)
  }
  catch {
    // Hash computation is best-effort for dedup
  }
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Image,
    body: file.name,
    url: mxcUrl,
    info,
    ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
  })
  return res.event_id
}

export async function sendFileMessage(roomId: string, file: File): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  let fileHash: string | undefined
  try {
    fileHash = await computeSha256(file)
  }
  catch {
    // best-effort
  }
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.File,
    body: file.name,
    url: mxcUrl,
    info: { mimetype: file.type, size: file.size },
    ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
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
  let fileHash: string | undefined
  try {
    fileHash = await computeSha256(file)
  }
  catch {
    // best-effort
  }
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Video,
    body: file.name,
    url: mxcUrl,
    info,
    ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
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

export async function editMessage(
  roomId: string,
  eventId: string,
  newBody: string,
  html?: string,
  options?: SendTextOptions,
): Promise<void> {
  const newContent = createTextMessageContent(newBody, html, options)
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

export async function replyToMessage(
  roomId: string,
  eventId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): Promise<void> {
  const content = createTextMessageContent(body, html, options)
  await getClient().sendMessage(roomId, {
    ...content,
    'm.relates_to': { 'm.in_reply_to': { event_id: eventId } },
  } as RoomMessageEventContent)
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
