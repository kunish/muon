import { Preset } from 'matrix-js-sdk'
import { getClient } from './client'

export async function initCrypto(): Promise<void> {
  const client = getClient()
  await client.initRustCrypto()
  const crypto = client.getCrypto()
  if (crypto) {
    await crypto.setTrustCrossSignedDevices(true)
  }
}

export async function createEncryptedRoom(name: string, userIds: string[]): Promise<string> {
  const client = getClient()
  const { room_id } = await client.createRoom({
    name,
    invite: userIds,
    initial_state: [
      {
        type: 'm.room.encryption',
        content: { algorithm: 'm.megolm.v1.aes-sha2' },
      },
    ],
    preset: Preset.PrivateChat,
  })
  return room_id
}
