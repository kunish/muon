import { getClient } from './client'

export async function initCrypto(): Promise<void> {
  const client = getClient() as any
  await client.initCrypto()
  client.setCryptoTrustCrossSignedDevices(true)
}

export async function createEncryptedRoom(
  name: string,
  userIds: string[],
): Promise<string> {
  const client = getClient()
  const { room_id } = await client.createRoom({
    name,
    invite: userIds,
    initial_state: [{
      type: 'm.room.encryption',
      content: { algorithm: 'm.megolm.v1.aes-sha2' },
    }],
    preset: 'private_chat' as any,
  })
  return room_id
}
