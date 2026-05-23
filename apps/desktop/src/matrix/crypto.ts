import { Effect } from 'effect'
import { Preset } from 'matrix-js-sdk'
import { fromPromise, runDesktopEffect } from '@/shared/lib/effect'
import { getClient } from './client'

export function initCryptoEffect() {
  return Effect.gen(function* () {
    const client = getClient()
    yield* fromPromise(() => client.initRustCrypto())
    const crypto = client.getCrypto()
    if (crypto) {
      yield* fromPromise(() => crypto.setTrustCrossSignedDevices(true))
    }
  })
}

export function initCrypto(): Promise<void> {
  return runDesktopEffect(initCryptoEffect())
}

export function createEncryptedRoomEffect(name: string, userIds: string[]) {
  return Effect.gen(function* () {
    const client = getClient()
    const { room_id } = yield* fromPromise(() =>
      client.createRoom({
        name,
        invite: userIds,
        initial_state: [
          {
            type: 'm.room.encryption',
            content: { algorithm: 'm.megolm.v1.aes-sha2' },
          },
        ],
        preset: Preset.PrivateChat,
      }),
    )
    return room_id
  })
}

export function createEncryptedRoom(name: string, userIds: string[]): Promise<string> {
  return runDesktopEffect(createEncryptedRoomEffect(name, userIds))
}
