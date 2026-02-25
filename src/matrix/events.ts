import mitt from 'mitt'
import { getClient } from './client'

// eslint-disable-next-line ts/consistent-type-definitions
type MatrixEvents = {
  'room.message': { roomId: string, event: any }
  'room.redaction': { roomId: string, eventId: string }
  'room.typing': { roomId: string, userIds: string[] }
  'room.receipt': { roomId: string, eventId: string, userId: string }
  'room.member': { roomId: string, userId: string, membership: string }
  'sync.state': { state: string }
}

export const matrixEvents = mitt<MatrixEvents>()

let bound = false

export function bindClientEvents(): void {
  if (bound)
    return
  const client = getClient()

  client.on('Room.timeline' as any, (event: any, room: any) => {
    if (event.getType() === 'm.room.message') {
      matrixEvents.emit('room.message', {
        roomId: room.roomId,
        event,
      })
    }
  })

  client.on('Room.redaction' as any, (event: any, room: any) => {
    matrixEvents.emit('room.redaction', {
      roomId: room.roomId,
      eventId: event.getId()!,
    })
  })

  client.on('RoomMember.typing' as any, (_event: any, member: any) => {
    const room = member.room
    if (!room)
      return
    const typingMembers = room.getMembers()
      .filter((m: any) => m.typing)
      .map((m: any) => m.userId)
    matrixEvents.emit('room.typing', {
      roomId: room.roomId,
      userIds: typingMembers,
    })
  })

  client.on('Room.receipt' as any, (event: any, room: any) => {
    const content = event.getContent()
    for (const eventId of Object.keys(content)) {
      const readers = content[eventId]['m.read'] || {}
      for (const userId of Object.keys(readers)) {
        matrixEvents.emit('room.receipt', {
          roomId: room.roomId,
          eventId,
          userId,
        })
      }
    }
  })

  client.on('RoomMember.membership' as any, (_event: any, member: any) => {
    matrixEvents.emit('room.member', {
      roomId: member.roomId,
      userId: member.userId,
      membership: member.membership,
    })
  })

  bound = true
}

export function unbindClientEvents(): void {
  if (!bound)
    return
  try {
    getClient().removeAllListeners()
  }
  catch {
    // client may already be destroyed
  }
  bound = false
}
