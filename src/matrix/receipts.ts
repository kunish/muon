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
