import { getClient } from '@matrix/client'

export function useContacts() {
  function getPresence(userId: string): 'online' | 'offline' | 'unavailable' {
    try {
      const user = getClient().getUser(userId)
      if (!user)
        return 'offline'
      return (user.presence as any) || 'offline'
    }
    catch {
      return 'offline'
    }
  }

  async function createDirectMessage(userId: string): Promise<string> {
    const client = getClient()
    const { room_id } = await client.createRoom({
      is_direct: true,
      invite: [userId],
      preset: 'trusted_private_chat' as any,
    })
    return room_id
  }

  async function searchUsers(term: string) {
    const client = getClient()
    const { results } = await client.searchUserDirectory({ term, limit: 20 })
    return results
  }

  return { getPresence, createDirectMessage, searchUsers }
}
