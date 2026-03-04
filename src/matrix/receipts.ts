import { getClient } from './client'

export async function sendReadReceipt(roomId: string, eventId: string): Promise<void> {
  const room = getClient().getRoom(roomId)
  if (!room)
    return
  const event = room.findEventById(eventId)
  if (event) {
    await getClient().sendReadReceipt(event)
  }
}

/** 获取当前用户在房间中的已读标记事件 ID */
export function getReadMarkerEventId(roomId: string): string | null {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return null

  const fullyRead = room.getAccountData('m.fully_read')
  if (fullyRead) {
    const eventId = fullyRead.getContent()?.event_id
    if (eventId)
      return eventId
  }

  const userId = client.getUserId()
  if (!userId)
    return null
  const receiptEventId = room.getEventReadUpTo(userId)
  return receiptEventId || null
}

/** 获取已读某条消息的用户列表（排除自己） */
export function getReadUsers(roomId: string, eventId: string): { userId: string, name: string, avatar?: string }[] {
  const client = getClient()
  const room = client.getRoom(roomId)
  if (!room)
    return []

  const myUserId = client.getUserId()
  const members = room.getJoinedMembers()
  const result: { userId: string, name: string, avatar?: string }[] = []
  const timeline = room.getLiveTimeline().getEvents()
  const targetIdx = timeline.findIndex(e => e.getId() === eventId)

  for (const member of members) {
    if (member.userId === myUserId)
      continue
    const readUpTo = room.getEventReadUpTo(member.userId)
    if (!readUpTo)
      continue

    // 检查该用户的已读位置是否 >= 目标事件
    if (targetIdx < 0)
      continue
    const readIdx = timeline.findIndex(e => e.getId() === readUpTo)
    if (readIdx < 0)
      continue
    if (readIdx >= targetIdx) {
      const avatar = member.getMxcAvatarUrl() || undefined
      result.push({
        userId: member.userId,
        name: member.name || member.userId.split(':')[0].slice(1),
        avatar,
      })
    }
  }

  return result
}
