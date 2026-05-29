import type { RoomMessageEventContent, StickerEventContent } from 'matrix-js-sdk/lib/@types/events'
import type { VideoInfo } from 'matrix-js-sdk/lib/@types/media'
import type { DesktopEffect } from '@/shared/lib/effect'
import { htmlToPlainText, sanitizeMatrixHtml } from '@muon/rich-text'
import { Effect } from 'effect'
import { EventType, MsgType, RelationType } from 'matrix-js-sdk'
import { fetch as desktopFetch } from '@/desktop/http'
import { BLURHASH_INFO_KEY } from '@/shared/lib/blurhash'
import { fromPromise, fromSync, runDesktopEffect } from '@/shared/lib/effect'
import { computeSha256, escapeHtml } from '@/shared/lib/utils'
import { getClient } from '../client'
import { extractImageMeta, uploadMedia } from '../media'
import { getTimeline } from './timeline'

const MENTION_SPAN_RE = /<span[^>]*data-type="mention"[^>]*data-id="([^"]*)"[^>]*>@?([^<]*)<\/span>/g
const NON_PLAIN_HTML_RE = /<(?:[abisu]|blockquote|code|del|em|h[1-6]|img|li|ol|pre|span|strong|ul)[\s>/]/i
const MATRIX_HTML_FORMAT = 'org.matrix.custom.html' as const

interface MatrixTextContent {
  msgtype: MsgType.Text
  body: string
  format?: typeof MATRIX_HTML_FORMAT
  formatted_body?: string
  'm.mentions'?: { user_ids?: string[]; room?: boolean }
  // MSC4019 (unstable). Recognizing clients should suppress notifications and
  // sound; others fall back to normal notifying behavior. Track stabilization at
  // https://github.com/matrix-org/matrix-spec-proposals/pull/4019.
  'org.matrix.msc4019.silent'?: true
}

/**
 * 将 TipTap mention HTML 转换为 Matrix 格式
 * TipTap: <span data-type="mention" data-id="@user:server" class="mention">@DisplayName</span>
 * Matrix: <a href="https://matrix.to/#/@user:server">DisplayName</a>
 * 特例 "@room"（@所有人）：渲染为高亮 span 并标记 room 提及，而非用户链接。
 */
function convertMentionsToMatrix(html: string): { html: string; userIds: string[]; room: boolean } {
  const userIds: string[] = []
  let room = false
  const converted = html.replace(MENTION_SPAN_RE, (_match, userId: string, label: string) => {
    if (userId === '@room') {
      room = true
      return `<span class="mention-room">@${label}</span>`
    }
    if (userId && !userIds.includes(userId)) {
      userIds.push(userId)
    }
    return `<a href="https://matrix.to/#/${userId}">${label}</a>`
  })
  return { html: converted, userIds, room }
}

export interface SendTextOptions {
  silent?: boolean
}

export function sendTextMessageEffect(
  roomId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const content = createTextMessageContent(body, html, options)
    const res = yield* fromPromise(() => getClient().sendMessage(roomId, content as RoomMessageEventContent))
    return res.event_id
  })
}

export function sendTextMessage(
  roomId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): Promise<string> {
  return runDesktopEffect(sendTextMessageEffect(roomId, body, html, options))
}

function createTextMessageContent(body: string, html?: string, options?: SendTextOptions): MatrixTextContent {
  const silentTag = options?.silent ? ({ 'org.matrix.msc4019.silent': true } as const) : null
  if (html && !isPlainEditorHtml(html, body)) {
    const { html: matrixHtml, userIds, room } = convertMentionsToMatrix(html)
    const formattedBody = sanitizeMatrixHtml(matrixHtml)
    const mentions: { user_ids?: string[]; room?: boolean } = {}
    if (userIds.length > 0) mentions.user_ids = userIds
    if (room) mentions.room = true
    return {
      msgtype: MsgType.Text,
      body,
      format: MATRIX_HTML_FORMAT,
      formatted_body: formattedBody,
      // 添加 m.mentions 用于通知被提及的用户 / @所有人 (room)
      ...(userIds.length > 0 || room ? { 'm.mentions': mentions } : {}),
      ...(silentTag ?? {}),
    }
  }

  return { msgtype: MsgType.Text, body, ...(silentTag ?? {}) }
}

function isPlainEditorHtml(html: string, body: string): boolean {
  return !NON_PLAIN_HTML_RE.test(html) && htmlToPlainText(html) === body.trim()
}

function computeFileHashEffect(file: File | Blob): DesktopEffect<string | undefined> {
  return fromPromise(() => computeSha256(file)).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
}

export function sendImageMessageEffect(roomId: string, file: File): DesktopEffect<string> {
  return Effect.gen(function* () {
    const meta = yield* fromPromise(() => extractImageMeta(file)).pipe(
      Effect.catchAll((error) =>
        fromSync(() => {
          console.warn('[upload] failed to extract image meta', error)
          return null
        }),
      ),
    )
    const mxcUrl = yield* fromPromise(() => uploadMedia(file))
    const info: { mimetype: string; size: number; w?: number; h?: number; [BLURHASH_INFO_KEY]?: string } = {
      mimetype: file.type,
      size: file.size,
    }
    if (meta) {
      info.w = meta.width
      info.h = meta.height
      if (meta.blurhash) info[BLURHASH_INFO_KEY] = meta.blurhash
    }
    // Hash for server-side deduplication (秒传)
    const fileHash = yield* computeFileHashEffect(file)
    const res = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Image,
        body: file.name,
        url: mxcUrl,
        info,
        ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
      }),
    )
    return res.event_id
  })
}

export function sendImageMessage(roomId: string, file: File): Promise<string> {
  return runDesktopEffect(sendImageMessageEffect(roomId, file))
}

export function sendFileMessageEffect(roomId: string, file: File): DesktopEffect<string> {
  return Effect.gen(function* () {
    const mxcUrl = yield* fromPromise(() => uploadMedia(file))
    const fileHash = yield* computeFileHashEffect(file)
    const res = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.File,
        body: file.name,
        url: mxcUrl,
        info: { mimetype: file.type, size: file.size },
        ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
      }),
    )
    return res.event_id
  })
}

export function sendFileMessage(roomId: string, file: File): Promise<string> {
  return runDesktopEffect(sendFileMessageEffect(roomId, file))
}

export function sendVideoMessageEffect(
  roomId: string,
  file: File,
  meta?: { thumbnail: Blob; width: number; height: number; duration: number; thumbnailBlurhash?: string },
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const mxcUrl = yield* fromPromise(() => uploadMedia(file))
    const info: VideoInfo & { [BLURHASH_INFO_KEY]?: string } = { mimetype: file.type, size: file.size }
    if (meta) {
      info.w = meta.width
      info.h = meta.height
      info.duration = meta.duration
      if (meta.thumbnailBlurhash) info[BLURHASH_INFO_KEY] = meta.thumbnailBlurhash
      info.thumbnail_url = yield* fromPromise(() => uploadMedia(meta.thumbnail))
      info.thumbnail_info = {
        mimetype: 'image/jpeg',
        w: meta.width,
        h: meta.height,
      }
    }
    const fileHash = yield* computeFileHashEffect(file)
    const res = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Video,
        body: file.name,
        url: mxcUrl,
        info,
        ...(fileHash ? { 'xyz.muon.file_hash': fileHash } : {}),
      } as RoomMessageEventContent),
    )
    return res.event_id
  })
}

export function sendVideoMessage(
  roomId: string,
  file: File,
  meta?: { thumbnail: Blob; width: number; height: number; duration: number; thumbnailBlurhash?: string },
): Promise<string> {
  return runDesktopEffect(sendVideoMessageEffect(roomId, file, meta))
}

export function sendAudioMessageEffect(roomId: string, file: Blob, duration: number): DesktopEffect<string> {
  return Effect.gen(function* () {
    const mxcUrl = yield* fromPromise(() => uploadMedia(file))
    const res = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Audio,
        body: 'Voice message',
        url: mxcUrl,
        info: { mimetype: file.type, size: file.size, duration },
      } as RoomMessageEventContent),
    )
    return res.event_id
  })
}

export function sendAudioMessage(roomId: string, file: Blob, duration: number): Promise<string> {
  return runDesktopEffect(sendAudioMessageEffect(roomId, file, duration))
}

export function editMessageEffect(
  roomId: string,
  eventId: string,
  newBody: string,
  html?: string,
  options?: SendTextOptions,
): DesktopEffect<void> {
  return Effect.gen(function* () {
    const newContent = createTextMessageContent(newBody, html, options)
    const replacementContent: MatrixTextContent = {
      ...newContent,
      body: `* ${newContent.body}`,
    }

    if (replacementContent.formatted_body)
      replacementContent.formatted_body = prefixEditedFormattedBody(replacementContent.formatted_body)

    yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        ...replacementContent,
        'm.new_content': newContent,
        'm.relates_to': { rel_type: RelationType.Replace, event_id: eventId },
      } as RoomMessageEventContent),
    )
  })
}

export function editMessage(
  roomId: string,
  eventId: string,
  newBody: string,
  html?: string,
  options?: SendTextOptions,
): Promise<void> {
  return runDesktopEffect(editMessageEffect(roomId, eventId, newBody, html, options))
}

function prefixEditedFormattedBody(formattedBody: string): string {
  const paragraphIndex = formattedBody.indexOf('<p>')
  if (paragraphIndex >= 0) {
    return `${formattedBody.slice(0, paragraphIndex)}${formattedBody.slice(paragraphIndex).replace('<p>', '<p>* ')}`
  }
  return `<p>* ${formattedBody}</p>`
}

export function redactMessageEffect(roomId: string, eventId: string, reason?: string): DesktopEffect<void> {
  return fromPromise(() => getClient().redactEvent(roomId, eventId, undefined, reason ? { reason } : undefined)).pipe(
    Effect.asVoid,
  )
}

export function redactMessage(roomId: string, eventId: string, reason?: string): Promise<void> {
  return runDesktopEffect(redactMessageEffect(roomId, eventId, reason))
}

export function replyToMessageEffect(
  roomId: string,
  eventId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): DesktopEffect<void> {
  return Effect.gen(function* () {
    const content = createTextMessageContent(body, html, options)
    yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        ...content,
        'm.relates_to': { 'm.in_reply_to': { event_id: eventId } },
      } as RoomMessageEventContent),
    )
  })
}

export function replyToMessage(
  roomId: string,
  eventId: string,
  body: string,
  html?: string,
  options?: SendTextOptions,
): Promise<void> {
  return runDesktopEffect(replyToMessageEffect(roomId, eventId, body, html, options))
}

/** 发送 GIF 消息（作为 m.image，mimetype 标记为 image/gif） */
function fetchGifBlobEffect(url: string): DesktopEffect<Blob> {
  return Effect.gen(function* () {
    const res = yield* fromPromise(() => desktopFetch(url))
    if (!res.ok) {
      return yield* fromSync(() => {
        throw new Error(`GIF fetch failed: ${res.status}`)
      })
    }
    const buf = yield* fromPromise(() => res.arrayBuffer())
    const contentType = res.headers.get('content-type') || 'image/gif'
    return new Blob([buf], { type: contentType })
  }).pipe(
    Effect.catchAll(() =>
      Effect.gen(function* () {
        // Fallback: browser fetch (for environments where plugin-http is unavailable)
        const resp = yield* fromPromise(() => fetch(url))
        if (!resp.ok) {
          return yield* fromSync(() => {
            throw new Error(`GIF fetch failed: ${resp.status}`)
          })
        }
        return yield* fromPromise(() => resp.blob())
      }),
    ),
  )
}

export function sendGifMessageEffect(
  roomId: string,
  url: string,
  width: number,
  height: number,
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const gifBlob = yield* fetchGifBlobEffect(url)
    const mxcUrl = yield* fromPromise(() => uploadMedia(gifBlob))

    const res = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Image,
        body: 'GIF',
        url: mxcUrl,
        info: {
          mimetype: 'image/gif',
          size: gifBlob.size,
          w: width,
          h: height,
        },
        'xyz.muon.gif_source': url,
      } as RoomMessageEventContent),
    )
    return res.event_id
  })
}

export function sendGifMessage(roomId: string, url: string, width: number, height: number): Promise<string> {
  return runDesktopEffect(sendGifMessageEffect(roomId, url, width, height))
}

/** 发送 emoji 贴纸消息 */
export function sendStickerMessageEffect(roomId: string, emoji: string, name: string): DesktopEffect<string> {
  return Effect.gen(function* () {
    const res = yield* fromPromise(() =>
      getClient().sendEvent(roomId, EventType.Sticker, {
        body: name,
        url: '',
        info: {
          mimetype: 'text/plain',
          'xyz.muon.emoji': emoji,
        },
      } as StickerEventContent),
    )
    return res.event_id
  })
}

export function sendStickerMessage(roomId: string, emoji: string, name: string): Promise<string> {
  return runDesktopEffect(sendStickerMessageEffect(roomId, emoji, name))
}

/** 发送图片贴纸消息 */
export function sendImageStickerMessageEffect(
  roomId: string,
  name: string,
  mxcUrl: string,
  info: { w: number; h: number; mimetype: string; size?: number },
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const res = yield* fromPromise(() =>
      getClient().sendEvent(roomId, EventType.Sticker, {
        body: name,
        url: mxcUrl,
        info: {
          w: info.w,
          h: info.h,
          mimetype: info.mimetype,
          size: info.size ?? 0,
        },
      } as StickerEventContent),
    )
    return res.event_id
  })
}

export function sendImageStickerMessage(
  roomId: string,
  name: string,
  mxcUrl: string,
  info: { w: number; h: number; mimetype: string; size?: number },
): Promise<string> {
  return runDesktopEffect(sendImageStickerMessageEffect(roomId, name, mxcUrl, info))
}

export function sendLocationMessageEffect(
  roomId: string,
  latitude: number,
  longitude: number,
  description?: string,
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const geoUri = `geo:${latitude},${longitude}`
    const body = description || `Location: ${latitude}, ${longitude}`
    const { event_id } = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: MsgType.Location,
        body,
        geo_uri: geoUri,
        info: {
          description: body,
        },
      } as RoomMessageEventContent),
    )
    return event_id
  })
}

export function sendLocationMessage(
  roomId: string,
  latitude: number,
  longitude: number,
  description?: string,
): Promise<string> {
  return runDesktopEffect(sendLocationMessageEffect(roomId, latitude, longitude, description))
}

/** 合并转发多条消息到目标房间 */
export function forwardMessagesEffect(roomId: string, targetRoomId: string, eventIds: string[]): DesktopEffect<string> {
  return Effect.gen(function* () {
    const timeline = getTimeline(roomId)
    const events = eventIds.map((id) => timeline.find((e) => e.getId() === id)).filter(Boolean)

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

    const { event_id } = yield* fromPromise(() =>
      getClient().sendMessage(targetRoomId, {
        msgtype: MsgType.Text,
        body: `[Forwarded] ${events.length} messages\n---\n${bodies.join('\n')}`,
        format: 'org.matrix.custom.html',
        formatted_body: `<blockquote><p><strong>[Forwarded] ${events.length} messages</strong></p>${htmlBodies.join('')}</blockquote>`,
      }),
    )
    return event_id
  })
}

export function forwardMessages(roomId: string, targetRoomId: string, eventIds: string[]): Promise<string> {
  return runDesktopEffect(forwardMessagesEffect(roomId, targetRoomId, eventIds))
}

/** 发送名片消息 */
export function sendContactCardEffect(
  roomId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
): DesktopEffect<string> {
  return Effect.gen(function* () {
    const { event_id } = yield* fromPromise(() =>
      getClient().sendMessage(roomId, {
        msgtype: 'im.muon.contact_card',
        body: `[Contact] ${displayName}`,
        'im.muon.contact_card': {
          user_id: userId,
          display_name: displayName,
          avatar_url: avatarUrl || '',
        },
      } as unknown as RoomMessageEventContent),
    )
    return event_id
  })
}

export function sendContactCard(
  roomId: string,
  userId: string,
  displayName: string,
  avatarUrl?: string,
): Promise<string> {
  return runDesktopEffect(sendContactCardEffect(roomId, userId, displayName, avatarUrl))
}
