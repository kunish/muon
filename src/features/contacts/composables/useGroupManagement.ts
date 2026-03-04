import { getClient } from '@matrix/client'

export function useGroupManagement() {
  async function createGroup(opts: {
    name: string
    topic?: string
    userIds: string[]
    isEncrypted?: boolean
  }): Promise<string> {
    const client = getClient()
    const initialState = opts.isEncrypted
      ? [{ type: 'm.room.encryption', content: { algorithm: 'm.megolm.v1.aes-sha2' }, state_key: '' }]
      : []
    const { room_id } = await client.createRoom({
      name: opts.name,
      topic: opts.topic,
      invite: opts.userIds,
      initial_state: initialState,
      preset: 'private_chat' as any,
    })
    return room_id
  }

  async function inviteUser(roomId: string, userId: string) {
    await getClient().invite(roomId, userId)
  }

  async function kickUser(roomId: string, userId: string, reason?: string) {
    await getClient().kick(roomId, userId, reason)
  }

  async function setUserPowerLevel(roomId: string, userId: string, level: number) {
    const client = getClient()
    const room = client.getRoom(roomId)
    if (!room)
      return
    const plEvent = room.currentState.getStateEvents('m.room.power_levels', '')
    const content = plEvent?.getContent() || {}
    const users = { ...content.users, [userId]: level }
    await client.sendStateEvent(roomId, 'm.room.power_levels' as any, { ...content, users })
  }

  return { createGroup, inviteUser, kickUser, setUserPowerLevel }
}
