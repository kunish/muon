import { getClient } from './client'

export async function sendTyping(roomId: string, isTyping: boolean, timeout = 5000): Promise<void> {
  await getClient().sendTyping(roomId, isTyping, timeout)
}
