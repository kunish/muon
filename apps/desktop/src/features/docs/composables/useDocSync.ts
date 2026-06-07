import type { MatrixClient } from 'matrix-js-sdk'
import type { DesktopEffect } from '@/shared/lib/effect'
import { getClient } from '@matrix/client'
import { Effect } from 'effect'
import { Doc } from 'yjs'
import { fromPromise, fromSync, runDesktopEffect, runDesktopSync } from '@/shared/lib/effect'
import { MatrixSyncProvider } from '../services/matrixSyncProvider'

interface MatrixJoinRoomResult {
  roomId?: string
  room_id?: string
}

export function useDocSync(docId: string) {
  const ydoc = shallowRef(new Doc())
  const provider = shallowRef<MatrixSyncProvider | null>(null)
  const connected = shallowRef(false)
  const error = shallowRef<string | null>(null)

  function resolveRoomIdEffect(client: MatrixClient): DesktopEffect<string> {
    return Effect.gen(function* () {
      const cachedRoom = client.getRoom(docId)
      if (cachedRoom) return cachedRoom.roomId ?? docId

      const result = (yield* fromPromise(() => client.joinRoom(docId))) as MatrixJoinRoomResult
      const joinedRoomId = result.roomId ?? result.room_id ?? docId
      return client.getRoom(joinedRoomId)?.roomId ?? joinedRoomId
    })
  }

  function connectEffect(): DesktopEffect<void> {
    return Effect.gen(function* () {
      const client: MatrixClient = getClient()
      const roomId = yield* resolveRoomIdEffect(client)

      yield* fromSync(() => {
        provider.value = new MatrixSyncProvider(ydoc.value, roomId, client)
        provider.value.sendSnapshot()
        connected.value = true
        error.value = null
      })
    }).pipe(
      Effect.catchAll((e) =>
        fromSync(() => {
          error.value = e instanceof Error ? e.message : 'Failed to connect'
          connected.value = false
        }),
      ),
    )
  }

  function connect(): Promise<void> {
    return runDesktopEffect(connectEffect())
  }

  function disconnectEffect(): DesktopEffect<void> {
    return fromSync(() => {
      provider.value?.destroy()
      provider.value = null
      connected.value = false
    })
  }

  function disconnect(): void {
    runDesktopSync(disconnectEffect())
  }

  onUnmounted(() => {
    disconnect()
  })

  return { ydoc, provider, connected, error, resolveRoomIdEffect, connectEffect, disconnectEffect, connect, disconnect }
}
