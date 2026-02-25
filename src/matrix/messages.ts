import type { MatrixEvent } from 'matrix-js-sdk'
import { MsgType, RelationType } from 'matrix-js-sdk'
import { getClient } from './client'
import { uploadMedia } from './media'

export async function sendTextMessage(roomId: string, body: string): Promise<string> {
  const res = await getClient().sendMessage(roomId, { msgtype: MsgType.Text, body })
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

export async function sendVideoMessage(roomId: string, file: File, thumbnail?: Blob): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const info: Record<string, any> = { mimetype: file.type, size: file.size }
  if (thumbnail)
    info.thumbnail_url = await uploadMedia(thumbnail)
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Video,
    body: file.name,
    url: mxcUrl,
    info,
  } as any)
  return res.event_id
}

export async function sendAudioMessage(roomId: string, file: Blob, duration: number): Promise<string> {
  const mxcUrl = await uploadMedia(file)
  const res = await getClient().sendMessage(roomId, {
    msgtype: MsgType.Audio,
    body: 'Voice message',
    url: mxcUrl,
    info: { mimetype: file.type, size: file.size, duration },
  } as any)
  return res.event_id
}

export async function editMessage(roomId: string, eventId: string, newBody: string): Promise<void> {
  await getClient().sendMessage(roomId, {
    'msgtype': MsgType.Text,
    'body': `* ${newBody}`,
    'm.new_content': { msgtype: MsgType.Text, body: newBody },
    'm.relates_to': { rel_type: RelationType.Replace, event_id: eventId },
  } as any)
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

export function getTimeline(roomId: string, limit = 50): MatrixEvent[] {
  const room = getClient().getRoom(roomId)
  if (!room)
    return []
  return room.getLiveTimeline().getEvents().slice(-limit)
}

export async function paginateBack(roomId: string, count = 20): Promise<boolean> {
  const room = getClient().getRoom(roomId)
  if (!room)
    return false
  return getClient().paginateEventTimeline(room.getLiveTimeline(), { backwards: true, limit: count })
}
