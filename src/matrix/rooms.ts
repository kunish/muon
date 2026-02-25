import type { Room } from 'matrix-js-sdk'
import type { RoomSummary } from './types'
import { NotificationCountType } from 'matrix-js-sdk'
import { getClient } from './client'

export function getRooms(): Room[] {
  return getClient().getRooms()
}

export function getRoom(roomId: string): Room | null {
  return getClient().getRoom(roomId)
}

export function getRoomSummaries(): RoomSummary[] {
  const client = getClient()
  const rooms = client.getRooms()

  return rooms
    .map((room): RoomSummary => {
      const lastEvent = room.timeline[room.timeline.length - 1]
      const members = room.getJoinedMembers().map(m => m.userId)
      const dmUserId = room.getDMInviter() || members.find(id => id !== client.getUserId())

      return {
        roomId: room.roomId,
        name: room.name || 'Unnamed',
        avatar: room.getAvatarUrl(client.baseUrl, 40, 40, 'crop') || undefined,
        lastMessage: lastEvent?.getContent()?.body,
        lastMessageTs: lastEvent?.getTs(),
        unreadCount: room.getUnreadNotificationCount(NotificationCountType.Total) || 0,
        isDirect: !!dmUserId,
        isEncrypted: client.isRoomEncrypted(room.roomId),
        members,
      }
    })
    .sort((a, b) => (b.lastMessageTs || 0) - (a.lastMessageTs || 0))
}
