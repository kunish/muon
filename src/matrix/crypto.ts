import { Preset } from 'matrix-js-sdk'
import { getClient } from './client'

/** initCrypto and setCryptoTrustCrossSignedDevices are not on typed MatrixClient */
interface CryptoClient {
  initCrypto: () => Promise<void>
  setCryptoTrustCrossSignedDevices: (trust: boolean) => void
}

export async function initCrypto(): Promise<void> {
  const client = getClient() as unknown as CryptoClient
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
    preset: Preset.PrivateChat,
  })
  return room_id
}
